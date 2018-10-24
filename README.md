# RegressionChecker
This is an automation tool kit to check regression easily for developers when submitting Web ML API PRs with high quality(avoiding new problems such as crash, freeze, etc.). 

## Prerequisites
* Chromium build is required to be installed on the target device before the test

## Get Code
```sh
   $ git clone https://github.com/cuiyanx/RegressionChecker.git
   $ cd RegressionChecker
   $ npm install
```
   If installing `chromedriver` fails, you can install `chromedriver` with this command:

      $ npm install chromedriver --chromedriver_cdnurl=http://cdn.npm.taobao.org/dist/chromedriver

## Set Configurations
   There are two fields in the config.json:
```
   {
     "platform": "Mac",
     "chromiumPath": "/User/test/Downloads/Chromium.app/Contents/MacOS/Chromium"
   }
```
   or
```
   {
     "platform": "Windows",
     "chromiumPath": "..\\Chrome-bin\\chrome.exe"
   }
```
   You need modify these two fields for the different platforms:
   + `platform`: `{string}`, target platform, support Android, Mac, Linux and Windows
   + `chromiumPath`: `{string}`, the installed chromium path on the target device. If the platform is `Android`, there is set chromiumPath of running platform. Because that will be used to display html page.

## Run Tests

```sh
$ npm start
```

## Run creating baseline data tool

```sh
$ npm run baseline
```

## Support Platforms

|  Linux  |   Mac   |  Android  |  Windows  |
|  :---:  |  :---:  |   :---:   |   :---:   |
|  PASS   |   PASS  |    PASS   |    PASS   |

## Result html

![result-html](./baseline/result-html.png)
