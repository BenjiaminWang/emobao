export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 只拦截发往 api.emobao.com 的请求
    if (url.hostname === "api.emobao.com") {
      // 你的 Supabase 项目地址
      const supabaseHost = "lmmnwmueppkdbzvufxar.supabase.co";
      
      // 构造新的目标 URL，保留原始路径和查询参数
      const targetUrl = new URL(request.url);
      targetUrl.hostname = supabaseHost;
      targetUrl.protocol = "https:";
      targetUrl.port = ""; // 确保端口为空，走默认 443

      // 创建一个新的请求，克隆原始请求的所有属性（方法、头、体）
      const newRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: "manual"
      });

      // 修改 Host 头以匹配 Supabase，避免某些后端校验报错
      newRequest.headers.set("Host", supabaseHost);

      // 发起请求并返回响应
      return fetch(newRequest);
    }

    // 如果不是发往 api.emobao.com 的请求，交还给 Pages 处理静态资源
    return env.ASSETS.fetch(request);
  }
};