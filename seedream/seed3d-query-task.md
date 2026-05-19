`GET https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/{id}`  [运行](https://api.volcengine.com/api-explorer/?action=Get3DGenerationsTask&groupName=3D%E7%94%9F%E6%88%90API&serviceCode=ark&tab=1&tab_result=1&tab_sdk=CURL&version=2024-01-01)
查询3D生成任务的状态。
:::tip
仅支持查询最近 7 天的历史数据。时间计算统一采用UTC时间戳，返回的7天历史数据范围以用户实际发起查询请求的时刻为基准（精确到秒），时间戳区间为 [T\-7天, T)。

:::
```mixin-react
return (<Tabs>
<Tabs.TabPane title="快速入口" key="fq9yXaKY"><RenderMd content={` [ ](#)[体验中心](https://console.volcengine.com/ark/region:ark+cn-beijing/experience/vision)       <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_2abecd05ca2779567c6d32f0ddc7874d.png =20x) </span>[模型列表](https://www.volcengine.com/docs/82379/1330310#.XzNk55Sf5oiQ6IO95Yqb)       <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_a5fdd3028d35cc512a10bd71b982b6eb.png =20x) </span>[模型计费](https://www.volcengine.com/docs/82379/1544106?lang=zh#.XzNk55Sf5oiQ5qih5Z6L)       <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_afbcf38bdec05c05089d5de5c3fd8fc8.png =20x) </span>[API Key](https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D)
 <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_57d0bca8e0d122ab1191b40101b5df75.png =20x) </span>[调用教程](https://www.volcengine.com/docs/82379/1874993)       <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_f45b5cd5863d1eed3bc3c81b9af54407.png =20x) </span>[接口文档](https://www.volcengine.com/docs/82379/1860231)       <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_1609c71a747f84df24be1e6421ce58f0.png =20x) </span>[常见问题](https://www.volcengine.com/docs/82379/1359411)       <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_bef4bc3de3535ee19d0c5d6c37b0ffdd.png =20x) </span>[开通模型](https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement?LLM=%7B%7D&OpenTokenDrawer=false)
`}></RenderMd></Tabs.TabPane>
<Tabs.TabPane title="鉴权说明" key="3vCxpwty"><RenderMd content={`本接口支持 API Key 鉴权，详见[鉴权认证方式](https://www.volcengine.com/docs/82379/1298459)。
`}></RenderMd></Tabs.TabPane></Tabs>);
```


---


<span id="RxN8G2nH"></span>
## 请求参数 
> 跳转 [响应参数](#7mi8G8RI)


---


**id** `string` %%require%%
您需要查询的3D生成任务的 ID 。
:::tip
上面参数为Query String Parameters，在URL String中传入。

:::
---


&nbsp;
<span id="7mi8G8RI"></span>
## 响应参数
> 跳转 [请求参数](#RxN8G2nH)


---


**id ** `string`
3D生成任务 ID 。

---


**model** `string`
任务实际使用的模型名称和版本，`模型名称-版本`。

---


**status** `string`
任务状态，以及相关的信息：

* `queued`：排队中。
* `running`：任务运行中。
* `cancelled`：取消任务，取消状态24h自动删除（只支持`queued`状态的任务被取消）。
* `succeeded`： 任务成功。
* `failed`：任务失败。


---


**error** `object`
错误提示信息。
任务失败时返回错误数据，具体参见 [错误处理](https://www.volcengine.com/docs/82379/1299023#.5pa56Iif6ZSZ6K-v56CB)。

属性

---


error.**code** `string`
错误码。

---


error.**message** `string`
错误提示信息。


---


**created_at** `integer`
任务创建时间的 Unix 时间戳（秒）。

---


**updated_at** `integer`
任务当前状态更新时间的 Unix 时间戳（秒）。

---


**content** `object`
3D生成任务的输出内容。

属性

---


content.f**ile_url** `string`
生成的3D文件的url。为保障信息安全，生成的3D文件会在24小时后被清理，请及时转存。
:::tip

* 模型会自动将生成的3D文件打包为.zip格式以供下载，压缩包内文件的格式与您创建任务时所指定的格式一致。
* 推荐配置火山引擎 TOS 提供的数据订阅功能，将您的模型推理产物自动转存到自己的 TOS 桶中，便于长期备份或二次加工。详细介绍请参见 [TOS 数据订阅](https://www.volcengine.com/docs/6349/2280949?lang=zh)。

:::

---


**subdivisionlevel** `string` 
3D文件中多边形面的数量。

---


**fileformat** `string` 
生成的3D文件格式。

---


**usage** `object`
本次请求的 token 用量。

属性

---


usage.**completion_tokens** `integer`
模型输出3D文件花费的 token 数量。

---


usage.**total_tokens** `integer`
本次请求消耗的总 token 数量。3D生成模型不统计输入 token，输入 token 为 0，故 **total_tokens**=**completion_tokens**。




