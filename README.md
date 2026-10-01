# 成都-海安 夜间动卧方案

静态网页，用于长期查看成都 ↔ 海安之间适合“夜间在动卧完整睡一晚”的换乘方案。

## 目录

- `index.html`：页面入口
- `assets/app.js`：时间轴渲染与交互
- `assets/styles.css`：样式
- `data/train-plans.json`：全部车次、换乘、开行星期数据

## 更新车次

正常情况下只修改 `data/train-plans.json` 即可，无需改前端。

每个方案包含：
- `weekdays`：1=周一 ... 7=周日
- `depart/arrive`：总行程首末站与时间
- `segments`：列车区段和站内换乘区段
- `sleeper: true`：标记夜间动卧区段
- `waitMinutes`：站内换乘等待分钟数
- `tight: true`：标记偏紧换乘

## 本地查看

浏览器直接打开 HTML 时，部分浏览器会禁止 `fetch()` 本地 JSON。建议在仓库根目录运行任意静态 HTTP 服务，例如：

```bash
python3 -m http.server 8000
```

然后访问 `http://localhost:8000/`。
