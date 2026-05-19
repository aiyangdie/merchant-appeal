# 微信支付证书目录

将微信商户平台下载的文件放到此目录：

| 文件 | 说明 |
|------|------|
| `apiclient_key.pem` | 商户 API 私钥 |
| `wechatpay_platform.pem` | 微信支付平台证书（回调验签） |

在 `payment.secrets.env` 中配置：

```
WECHAT_PAY_PRIVATE_KEY_PATH=.../server/certs/wechat/apiclient_key.pem
WECHAT_PAY_CERT_PATH=.../server/certs/wechat/wechatpay_platform.pem
```

或在管理后台「微信支付」里直接粘贴 `apiclient_key.pem` 全文。
