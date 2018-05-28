# dm-epa-server
An API to get images out of EPA

## Setup
`npm init`

## Config

.env example:
```
ENVIRONMENT=development
BASE_URL=http://www.epa.eu
LOGIN_URL=http://www.epa.eu/login
SEARCH_URL=http://www.epa.eu/webgate?EVENT=WEBSHOP_SEARCH&SEARCHMODE=NEW&SEARCHTXT1=SEARCHSTR
DOWNLOAD_URL=http://www.epa.eu/webgate
LOCAL_URL=http://dmepa.dev
USERNAME=your_username
PASSWORD=your_password
PORT=80
APIUSERNAME=api_username
APIPASSWORD=api_password
```

The application will launch headless if `ENVIRONMENT=production`.

Leave APIUSERNAME out to skip basic auth.

## Launching
`npm start`

## Usage

**Search Input**

`curl 'http://localhost:9000/search?s=eurovision' --user api_username:api_password`

**Search Output**

```
{
    "status": "okay",
    "data": [
        {
            "uid": "54334723",
            "blurb": "epa06737033 Israeli singer Netta Barzilai, the winner of the 63rd annual Eurovision Song Contest (ESC), performs during a festive welcome at Rabin square in Tel Aviv, Israel, 14 May 2018. The ESC 2018 was held at the Altice Arena in Lisbon, Portugal.  EPA-EFE/STRINGER",
            "src": "http://www.epa.eu/thumb.php/54334723.jpg?eJwljLsOwjAMRf_FcwfbaZrHhjIhUZAIEjChNCRsDEAnyr9jpdORj--9XwjgAToIF_AkuDaMInWvVG9YyXO3Bc-CvejyfNzmdxIbWzSGFeOKE_jPay4dnGPrHEUb7OAgJ0zOKsZBl0qJKyPbYkjnAZExW5VldCMxcmTtQg4JF6rWOMW63lN2k8nw-wNJwypg",
            "download_url": "http://dmepa.dev:9000/download?url=aHR0cDovL3d3dy5lcGEuZXUvd2ViZ2F0ZT9TQ09QRT1NTSZNTT1NTV9fYjhiZThlOGEyMTRiJk09NTQzMzQ3MjMmRVZFTlQ9REQmTUVESUFTSVpFPTMmQUpBWD0xJlVQREFURT0x",
            "original_url": "http://www.epa.eu/webgate?SCOPE=MM&MM=MM__b8be8e8a214b&M=54334723&EVENT=DD&MEDIASIZE=3&AJAX=1&UPDATE=1"
        },
        {
            "uid": "54334722",
            "blurb": "epa06737032 Israeli singer Netta Barzilai, the winner of the 63rd annual Eurovision Song Contest (ESC), performs during a festive welcome at Rabin square in Tel Aviv, Israel, 14 May 2018. The ESC 2018 was held at the Altice Arena in Lisbon, Portugal.  EPA-EFE/STRINGER",
            "src": "http://www.epa.eu/thumb.php/54334722.jpg?eJwljLsOwjAMRf_FcwfbaZrHhjIhUZAIEjChNCRsDEAnyr9jpdORj--9XwjgAToIF_AkuDaMInWvVG-Y5bnbgmfBXnR5Pm7zO4mNLRrDinHFCfznNZcOzrF1jqINdnCQEyZnFeOgS6XElZFtMaTzgMiYrcoyupEYObJ2IYeEC1VrnGJd7ym7yWT4_QFJMipf",
            "download_url": "http://dmepa.dev:9000/download?url=aHR0cDovL3d3dy5lcGEuZXUvd2ViZ2F0ZT9TQ09QRT1NTSZNTT1NTV9fNjU1NWExNzk2ZTk3Jk09NTQzMzQ3MjImRVZFTlQ9REQmTUVESUFTSVpFPTMmQUpBWD0xJlVQREFURT0x",
            "original_url": "http://www.epa.eu/webgate?SCOPE=MM&MM=MM__6555a1796e97&M=54334722&EVENT=DD&MEDIASIZE=3&AJAX=1&UPDATE=1"
        }
        ...
   ]
}
```
