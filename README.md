# 2025 TechJam Hackathon

## Problem Statement:
**Using AI to defend user privacy and security** (AI for Privacy).

Our solution aims to act as a layer of security to prevent users from accidentally leaking PIIs on messaging platforms. Before a user sends a message, its validated for any potential PIIs via the AI model. Should there be any PIIs above a certain sensitivity threshold, its replaced by a dummy placeholder message. The user can then choose to show the original message if they wish to.  For images, the same concept applies except the image is censored/blurred.

## Deployment Instructions

### Install necessary dependencies:

```bash
(In backend dir)
pip install -r requirements.txt
```
```bash
(In frontend dir)
npm -i
```
Obtain a API key from https://aistudio.google.com/apikey and store it as "GEMINI_API_KEY" in your .env file

### Deploying:


backend directory:
```bash
Both should be running on the same server

To deploy the API server, run the "main.py" python file.

To deploy the text-model server, run the "gemini_pii_he_system.py" python file.
```

frontend directory:
```bash
npm run dev

Change the following var API_BASE_URL in "frontend/src/App.tsx" to the IP of the server running the above "main.py"
```



