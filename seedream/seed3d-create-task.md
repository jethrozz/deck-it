`POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks` [ ](https://api.volcengine.com/api-explorer/?action=CreateContentsGenerationsTasks&data=%7B%7D&groupName=%E8%A7%86%E9%A2%91%E7%94%9F%E6%88%90API&query=%7B%7D&serviceCode=ark&version=2024-01-01)[运行](https://api.volcengine.com/api-explorer/?action=Create3DGenerationsTasks&groupName=3D%E7%94%9F%E6%88%90API&serviceCode=ark&tab=1&tab_result=1&tab_sdk=CURL&version=2024-01-01#N4Igtg9gJgpgNiAXCKECuAjAhhAtAZxhigGYpcBGXABlwCYBWagTjoA4QAaEAYwgDsALjCFIA2qEEBPAA4wkIYQA9BXRTBULcBTFACWANz349AuDAPwABGGJ60YK9oBme884gAnMFkFWA5nAYIAC+nJKy8sh6Pv4wAPpongjcMVhxiclIoEkIyAAWgoIy+IgA9GVYngDWuDKeEABWMDyCAHSCEPi4PPy4GDB6jXr8-m0GEHA8MPhtfGBlqDzxaXFlhMRkK7EwACoQZG0yo6EhALohQA)
本文介绍创建3D生成任务 API 的输入输出参数，供您使用接口时查阅字段含义。模型会依据传入的图片信息生成3D，待生成完成后，您可以按条件查询任务并获取生成的3D文件。

**模型支持的3D生成能力简介**

* **doubao\-seed3d**
   * doubao\-seed3d\-2\-0\-260328：图生3D，根据您输入++图片（1张）+参数（可选）++ 生成一个带纹理和 PBR 材质的3D文件。


```mixin-react
return (<Tabs>
<Tabs.TabPane title="在线调试" key="cKmdyIjR"><RenderMd content={`<APILink link="https://api.volcengine.com/api-explorer/?action=Create3DGenerationsTasks&groupName=3D%E7%94%9F%E6%88%90API&serviceCode=ark&version=2024-01-01" description="API Explorer 您可以通过 API Explorer 在线发起调用，无需关注签名生成过程，快速获取调用结果。">去调试</APILink>

`}></RenderMd></Tabs.TabPane>
<Tabs.TabPane title="鉴权说明" key="vRJT6oJZ"><RenderMd content={`本接口仅支持 API Key 鉴权，请在 [获取 API Key](https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey) 页面，获取长效 API Key。
`}></RenderMd></Tabs.TabPane>
<Tabs.TabPane title="快速入口" key="CSfjyNtzyM"><RenderMd content={` [ ](#)[体验中心](https://console.volcengine.com/ark/region:ark+cn-beijing/experience/vision)       <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_2abecd05ca2779567c6d32f0ddc7874d.png =20x) </span>[模型列表](https://www.volcengine.com/docs/82379/1330310#.XzNk55Sf5oiQ6IO95Yqb)       <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_a5fdd3028d35cc512a10bd71b982b6eb.png =20x) </span>[模型计费](https://www.volcengine.com/docs/82379/1544106?lang=zh#.XzNk55Sf5oiQ5qih5Z6L)       <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_afbcf38bdec05c05089d5de5c3fd8fc8.png =20x) </span>[API Key](https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D)
 <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_57d0bca8e0d122ab1191b40101b5df75.png =20x) </span>[调用教程](https://www.volcengine.com/docs/82379/1874993)       <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_f45b5cd5863d1eed3bc3c81b9af54407.png =20x) </span>[接口文档](https://www.volcengine.com/docs/82379/1856293)       <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_1609c71a747f84df24be1e6421ce58f0.png =20x) </span>[常见问题](https://www.volcengine.com/docs/82379/1359411)       <span>![图片](https://portal.volccdn.com/obj/volcfe/cloud-universal-doc/upload_bef4bc3de3535ee19d0c5d6c37b0ffdd.png =20x) </span>[开通模型](https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement?LLM=%7B%7D&OpenTokenDrawer=false)
`}></RenderMd></Tabs.TabPane></Tabs>);
```


---


<span id="RxN8G2nH"></span>
## 请求参数 
> 跳转 [响应参数](#L9tzcCyD)

<span id="BJ5XLFqM"></span>
### 请求体

---


**model** `string` %%require%%
您需要调用的模型的 ID （Model ID），[开通模型服务](https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement?LLM=%7B%7D&OpenTokenDrawer=false)，并[查询 Model ID](https://www.volcengine.com/docs/82379/1330310) 。
您也可通过 Endpoint ID 来调用模型，获得限流、计费类型（前付费/后付费）、运行状态查询、监控、安全等高级能力，可参考[获取 Endpoint ID](https://www.volcengine.com/docs/82379/1099522)。

---


**content** `object[]` %%require%%
输入给模型，用于生成3D文件的信息。

信息类型

---


**图片信息** `object` %%require%%
输入给模型的图片内容，模型会根据输入的2D图像生成完整的3D文件。

属性

---


content.**type ** `string` %%require%%
输入内容的类型，此处应为 `image_url`。

---


content.**image_url ** `object` %%require%%
输入给模型的图片对象。

属性

---


content.image_url.**url ** `string` %%require%%
图片信息，可以是图片URL或图片 Base64 编码。

* 图片URL：请确保图片URL可被访问。
* Base64编码：请遵循此格式`data:image/<图片格式>;base64,<Base64编码>`，注意 `<图片格式>` 需小写，如 `data:image/png;base64,{base64_image}`。

:::tip
传入图片需要满足以下条件：

* 总像素：小于 4096×4096 px
* 大小：小于等于10MB
* 宽高比：(0.4, 2.5)
* 格式支持：jpg、jpeg、png、webp、bmp

:::


---


**文本信息** `object` 
输入给模型的文本内容，当前仅支持参数。

属性

---


content.**type ** `string` %%require%%
输入内容的类型，此处应为 `text`。

---


content.**text ** `string` %%require%%
输入给模型的文本内容，包括：
**参数（选填）** ：通过`--[parameters]`的方式，控制3D文件输出的规格，详情见 **模型文本命令(选填** **）** 。



---


&nbsp;
<span id="L9tzcCyD"></span>
### 模型文本命令(选填)
控制3D文件输出的规格。

示例
```JSON
// 指定生成的3D文件的多边形面的数量为100000面，生成的有纹理的模型文件格式为obj


"content": [
        {
            "type": "text",
            "text": "--subdivisionlevel medium --fileformat obj"
        }
    ]

```




---


**subdivisionlevel **  `string` `默认值 medium` `简写 sl`
3D文件中多边形面的数量。取值范围：`high`、`medium`、`low`。
具体对应的值根据不同模型不同取值。
`doubao-seed3d-2-0-260328`模型实际取值：

* `high`：1000000
* `medium`：500000
* `low`：100000


---


**fileformat ** `string` `默认值 glb` `简写 ff`
生成的3D文件格式。
枚举值：

* `glb` 、`obj`、`usd`、`usdz`


---


&nbsp;
<span id="L9tzcCyD"></span>
## 响应参数
> 跳转 [请求参数](#RxN8G2nH)

**id ** `string`
3D生成任务 ID 。创建3D生成任务为异步接口，获取 ID 后，需要通过 [查询3D生成任务 API](https://www.volcengine.com/docs/82379/1860231) 来查询3D生成任务的状态。任务成功后，会输出生成3D的`file_url`。

---




