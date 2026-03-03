# ListenLeap翻译助手 Chrome扩展

在ListenLeap网站的英文句子下方显示中文翻译。

## 文件结构

```
listenleap-translator/
├── manifest.json      # 扩展配置
├── background.js     # 翻译API服务
├── content.js        # 注入脚本
├── styles.css        # 翻译文字样式
├── popup.html        # 开关控制界面
├── popup.js          # 开关逻辑
└── README.md         # 说明文档
```

## 安装方法

### 1. 添加图标（可选）

由于PNG图标需要二进制文件，您可以：
- 使用任何喜欢的图片作为图标（16x16, 48x48, 128x128像素）
- 或者暂时跳过这步，Chrome会使用默认图标

### 2. 加载扩展到Chrome

1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择 `listenleap-translator` 文件夹

### 3. 使用方法

1. 访问 ListenLeap 网站的任意课程页面
2. 等待页面加载完成（约1-2秒）
3. 每个英文句子下方会自动显示中文翻译
4. 点击浏览器工具栏的扩展图标可以开启/关闭翻译

## 工作原理

- **自动识别**: 使用 `.paragraph_li .paragraph` 选择器，适用于所有ListenLeap课程
- **免费翻译**: 使用Google翻译网页端点，无需API Key
- **缓存机制**: 相同内容不会重复翻译，提升性能
- **速率限制**: 每次请求间隔300ms，避免被限流

## 故障排除

如果翻译没有显示：
1. 点击扩展图标确认翻译已启用
2. 刷新ListenLeap页面
3. 检查控制台是否有错误信息

## 技术说明

翻译API使用Google免费端点：
- `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=TEXT`

这是Google翻译网页版使用的API，无需API Key，但有使用限制。
