---
date: 2026-03-12
title: Android overlay 为什么“有时候生效、有时候不生效”？——以 ASServiceCenterInfo 为例
tags:
  - Android
  - Overlay
  - 构建系统
---

## Android overlay 为什么“有时候生效、有时候不生效”？——以 ASServiceCenterInfo 为例

这篇笔记记录一次卡住了半天的坑：**ASServiceCenterInfo 的 overlay 第一次改就生效，后面相同模式套用同一种overlay，java文件只读取了本地资源**。实际上，这是「**用哪个 product 编**」的问题。

---

### 1. 场景回顾

- App：`packages/RevoApps/ASServiceCenterInfo`
- Base 资源：

  ```xml
  <!-- res/values/strings.xml -->
  <string name="showHtmlString_sar">file:///android_asset/default_sar.html</string>
  <string name="showHtmlString_rcm">file:///android_asset/default_rcm.html</string>
  ```

- Device overlay：

  ```xml
  <!-- zrevo/e64_xx24-aozhou/overlay/S5518/.../res/values/strings.xml -->
  <resources>
      <string name="showHtmlString_sar">file:///android_asset/aozhou_sar.html</string>
      <string name="showHtmlString_rcm">file:///android_asset/aozhou_rcm.html</string>
  </resources>
  ```

- 代码里通过字符串名取资源：

  ```java
  String resName = getIntent().getStringExtra(EXTRA_HTML_RES_NAME);
  int resId = getResources().getIdentifier(resName, "string", getPackageName());
  if (resId == 0) {
      resId = R.string.showHtmlString; // 兜底
  }
  String url = getString(resId);       // 期望这里被 overlay 覆盖
  ```

**症状：**

- 第一次改 overlay（只覆盖 `showHtmlString`）时，AS 单独编译 + push 就能看到效果；
- 后面加了 `showHtmlString_sar/rcm`，在同一个 overlay 下改成 `aozhou_sar/rcm.html`，但无论怎么单独编 APK 都只看到 `default_sar/default_rcm`。

---

### 2. 关键点：overlay 绑定在“客户 product”，不是绑定在“底板 product”

工程里有两条概念不同的线：

- **客户项目 product（带 env 和 overlay）**

  ```ini
  # zrevo/e64_xx24-aozhou/env_e64_xx24-aozhou.ini
  [e64_xx24-aozhou-S5518]
  ...
  # overlay 路径：zrevo/e64_xx24-aozhou/overlay/S5518/...
  ```

  这一条决定：

  - 用哪份 `env_*.ini`（品牌名、型号、额外 app 列表等）
  - 用哪一个 `overlay/S5518` 目录覆盖 Settings / ASServiceCenterInfo 的资源

- **底板 / SoC product（ussi_arm64_full-userdebug-native）**

  ```bash
  lunch ussi_arm64_full-userdebug-native
  ```

  这一条更多是芯片平台的“基础环境”，**默认并不知道 `e64_xx24-aozhou/overlay/S5518` 里你改了什么**。

> 结论：**overlay 是挂在 `e64_xx24-aozhou-S5518` 这条 product 上的，而不是挂在 `ussi_arm64_full` 上。**

---

### 3. 为什么第一次“单独编 APK 也生效”

要让 overlay 文件真正进 APK，需要经历一次「**以挂了 overlay 的 product 为入口的编译**」，简单说就是：

```bash
. zrevo/envsetup.sh           # 选 e64_xx24-aozhou-S5518，这一步把 overlay/S5518 挂进 PRODUCT_PACKAGE_OVERLAYS
source build/envsetup.sh
lunch e64_xx24-aozhou-S5518-userdebug   # 或类似变体
m ASServiceCenterInfo -jN               # 或整包 make
```

在这之后：

- `out/` 目录里对应模块的资源，已经是「base + overlay merge 后」的版本；
- 后面即使你在同一个 out 上换个方式（看起来像“单独 mm AS”），也仍然在复用这套带 overlay 的资源。

**第一次“单独编也生效”，极大概率是：当时的 out 已经在某个时刻用 `e64_xx24-aozhou-S5518` 编过一轮，overlay 早就 merge 进去了，只是你当时没意识到这一点。**

---

### 4. 为什么这次怎么改 overlay 都不生效

这次的构建方式变成了：

```bash
. zrevo/envsetup.sh           # 这里虽然选了 AOZhou 产品，但后面又切了
source build/envsetup.sh
lunch ussi_arm64_full-userdebug-native
make ASServiceCenterInfo -j48
```

问题在于：

- 最终起作用的 **构建入口 product 是 `ussi_arm64_full-userdebug-native`**；
- 它的 product/device mk 里 **没有把 `zrevo/e64_xx24-aozhou/overlay/S5518` 挂到 `PRODUCT_PACKAGE_OVERLAYS`**；
- 于是，这一轮编译 ASServiceCenterInfo 时，只看到：

  ```text
  packages/RevoApps/ASServiceCenterInfo/res/values/strings.xml    ← 有 default_sar/default_rcm
  ```

  看不到：

  ```text
  zrevo/e64_xx24-aozhou/overlay/S5518/.../res/values/strings.xml  ← 有 aozhou_sar/aozhou_rcm
  ```

**结果：**

- APK 里只有 base 资源 → `getString(showHtmlString_sar/rcm)` 读到的就是 `default_sar/default_rcm`；
- 你怎么改 overlay/xml，都不会进到这次 APK 里，看起来就像“overlay 失效了”。

---

### 5. 如何让行为变得稳定、可预期

**推荐做法：始终用“客户 product”作为入口来编 ASServiceCenterInfo**

```bash
. zrevo/envsetup.sh
# 这里选 e64_xx24-aozhou-S5518（或其 userdebug / ota 变体）

source build/envsetup.sh
lunch e64_xx24-aozhou-S5518-userdebug

m ASServiceCenterInfo -j48   # 或 mm ASServiceCenterInfo
```

这样可以保证：

- 每次编 AS 时，参与资源合并的都是那套 `overlay/S5518`；
- `showHtmlString_sar/rcm` 一定会被 `aozhou_sar/rcm.html` 覆盖，不会再随机掉回 default。

**调试时的一个取巧办法：**

- 如果只是临时验证业务逻辑，又不想走完整 product 构建链路，可以在 base `strings.xml` 里把 AU 路径直接写死：

  ```xml
  <string name="showHtmlString_sar">file:///android_asset/aozhou_sar.html</string>
  <string name="showHtmlString_rcm">file:///android_asset/aozhou_rcm.html</string>
  ```

- 单独 `mm` ASServiceCenterInfo 即可看到效果；  
- 功能确认后再把 base 改回默认值、交由 overlay 控制，用产品编译链路产最终包。

---

### 6. 总结

> **Device overlay（`zrevo/e64_xx24-aozhou/overlay/S5518/...`）是绑在「具体项目 product」上的，不是绑在「底板 product」上的。  
> 用哪个 product 编 ASServiceCenterInfo，就决定了这次 APK 是否会吃到那套 overlay。**

