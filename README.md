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

## Launching
`npm start`
