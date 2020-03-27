# RegressionChecker
This is an automation tool kit to check regression easily for developers when submitting Web ML API PRs with high quality(avoiding new problems such as crash, freeze, etc.).

## Prerequisites
* Chromium build is required to be installed on the target device before the test
* For checking PRs relevant to Android platform, host pc needs install chrome or chromium browser firstly.

## Install
```sh
   $ npm install
```
   You need modify chromedriver version to '2.45.0' in package.json when you run chromium 70 build. chromedriver 2.46.0 supports chromium >=71.

   If installing `chromedriver` fails, you can install `chromedriver` with this command:

      $ npm install chromedriver --chromedriver_cdnurl=http://cdn.npm.taobao.org/dist/chromedriver

## Set Configurations
   There are fields in the config.json, for example:
```
   {
     "platform": "Mac",
     "chromiumPath": "/User/test/Downloads/Chromium.app/Contents/MacOS/Chromium",
     "switch": {
         "linux": {
             "IEMYRIAD": false,
             "INFERENCE_ENGINE": false
         },
         "mac": {
             "DNNL": true
         },
         "windows": {
             "DML": false,
             "INFERENCE_ENGINE": false
         }
     },
     "webmlPolyfill": true,
     "webnn": true,
     "remoteURL": "https://brucedai.github.io/webnnt/test/index-local.html",
     "needCheckRealModelTC": true,
     "localServerURL": "http://localhost:8080/test/squeezenet1.1.html"
   }
```
   or
```
   {
     "platform": "Windows",
     "chromiumPath": "C:\\test\\win_x64_SUCCEED\\Chrome-bin\\chrome.exe",
     "switch": {
         "linux": {
             "IEMYRIAD": false,
             "INFERENCE_ENGINE": false
         },
         "mac": {
             "DNNL": false
         },
         "windows": {
             "DML": false,
             "INFERENCE_ENGINE": true
         }
     },
     "webmlPolyfill": true,
     "webnn": true,
     "remoteURL": "https://brucedai.github.io/webnnt/test/index-local.html",
     "needCheckRealModelTC": true,
     "localServerURL": "http://localhost:8080/test/squeezenet1.1.html"
   }
```
   You need modify these nine fields for the different platforms:
   + **_platform_**: `{string}`, target platform, support **Android**, **Mac**, **Linux** and **Windows**.
   + **_chromiumPath_**: `{string}`, **Mac**/**Linux**/**Windows**: the target chromium path   **Android**: the chrome or chromium path in above Prerequisites to show the final checking results.
   + **_switch_**: `{boolean}`, **Mac**: `--use-dnnl`, **Linux**: `IE-MYRIAD` and `--use-inference-engine`, **Windows**: `--use-dml` and `--use-inference-engine`, support **true** and **false**.
   + **_webmlPolyfill_**: `{boolean}`, run RegressionChecker tool with **webmlPolyfill** backends, support **true** and **false**.
   + **_webnn_**: `{boolean}`, run RegressionChecker tool with **webnn** backends, support **true** and **false**.
   + **_remoteURL_**: `{string}`, the remote URL of general test cases.
   + **_needCheckRealModelTC_**: `{boolean}`, run real model test cases. support **true** and **false**.
   + **_localServerURL_**: `{string}`, the local URL of real model test cases.

## Run Tests

```sh
$ npm start
```

## Support Platforms

|  Linux  |   Mac   |  Android  |  Windows  |
|  :---:  |  :---:  |   :---:   |   :---:   |
|  PASS   |   PASS  |    PASS   |    PASS   |

## Result html

![result-html](./baseline/result-html.png)
