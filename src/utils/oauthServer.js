import http from "http";
import url from "url";
import fetch from "node-fetch";
import { findUserByDiscordId, saveUser } from "../db/firestore.js";

let server = null;

/**
 * Starts a local HTTP server to handle Discord OAuth2 callback.
 * @param {object} client - The Discord client instance.
 */
export function startOAuthServer(client) {
    const port = process.env.PORT || 3000;
    const clientSecret = process.env.CLIENT_SECRET;
    const clientId = process.env.CLIENT_ID;

    const isSecretConfigured = clientSecret && 
                               clientSecret !== "paste_client_secret_anda_di_sini" && 
                               clientSecret.trim() !== "";

    if (!isSecretConfigured) {
        console.warn("[OAuthServer] CLIENT_SECRET is missing or placeholder value in .env. OAuth2 member migration features will not be available.");
        return;
    }

    server = http.createServer(async (req, res) => {
        const parsedUrl = url.parse(req.url, true);

        if (parsedUrl.pathname === "/callback") {
            const code = parsedUrl.query.code;

            if (!code) {
                sendHtmlResponse(res, 400, "Authorization Code Missing", "Failed to retrieve authorization code from Discord.", false);
                return;
            }

            try {
                // 1. Exchange authorization code for tokens
                const redirectUri = `http://localhost:${port}/callback`;
                const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: new URLSearchParams({
                        client_id: clientId,
                        client_secret: clientSecret,
                        grant_type: "authorization_code",
                        code: code,
                        redirect_uri: redirectUri
                    })
                });

                if (!tokenResponse.ok) {
                    const errorData = await tokenResponse.json();
                    console.error("[OAuthServer] Token exchange failed:", errorData);
                    sendHtmlResponse(res, 400, "Token Exchange Failed", `Discord API Error: ${errorData.error_description || errorData.error || "Unknown error"}`, false);
                    return;
                }

                const tokens = await tokenResponse.json();

                // 2. Fetch authenticated user's Discord profile
                const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
                    headers: {
                        Authorization: `Bearer ${tokens.access_token}`
                    }
                });

                if (!userResponse.ok) {
                    sendHtmlResponse(res, 400, "Failed to Fetch Profile", "Could not retrieve your Discord ID using the acquired token.", false);
                    return;
                }

                const discordUser = await userResponse.json();
                const discordId = discordUser.id;

                // 3. Find user in Firestore and save OAuth tokens
                const user = await findUserByDiscordId(discordId);
                if (!user) {
                    sendHtmlResponse(res, 404, "User Not Found", `Verified Roblox user for Discord ID ${discordId} was not found in database. Please verify first using /verify.`, false);
                    return;
                }

                user.oauth = {
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token,
                    expiresAt: Date.now() + (tokens.expires_in * 1000),
                    scopes: tokens.scope.split(" ")
                };

                await saveUser(user);
                console.log(`[OAuthServer] Successfully saved migration OAuth tokens for ${user.robloxUsername} (${discordId}).`);

                sendHtmlResponse(res, 200, "Authorization Successful!", `Thank you, <strong>${user.robloxUsername}</strong>! Your Discord account has been successfully linked for member migration. You can close this window now.`, true);

            } catch (error) {
                console.error("[OAuthServer] OAuth process error:", error);
                sendHtmlResponse(res, 500, "Internal Server Error", "An unexpected error occurred during the authorization process.", false);
            }
        } else {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not Found");
        }
    });

    server.listen(port, () => {
        console.log(`[OAuthServer] OAuth callback server listening on http://localhost:${port}/callback`);
    });
}

function sendHtmlResponse(res, statusCode, title, message, isSuccess) {
    const color = isSuccess ? "#43b581" : "#f04747";
    const emoji = isSuccess ? "✅" : "❌";

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #2f3136;
                color: #dcddde;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
            }
            .card {
                background-color: #36393f;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                text-align: center;
                max-width: 500px;
                width: 90%;
            }
            h1 {
                color: ${color};
                margin-top: 0;
            }
            .icon {
                font-size: 48px;
                margin-bottom: 20px;
            }
            p {
                font-size: 16px;
                line-height: 1.5;
            }
            .footer {
                margin-top: 30px;
                font-size: 12px;
                color: #72767d;
            }
        </style>
        ${isSuccess ? `
        <script>
            // Attempt to automatically close the browser window after 1.5 seconds
            setTimeout(() => {
                window.close();
            }, 1500);
        </script>
        ` : ""}
    </head>
    <body>
        <div class="card">
            <div class="icon">${emoji}</div>
            <h1>${title}</h1>
            <p>${message}</p>
            ${isSuccess ? `<p style="font-size: 13px; color: #72767d; margin-top: 10px;">This tab will attempt to close automatically...</p>` : ""}
            <div class="footer">Mooncrest Bot Integration</div>
        </div>
    </body>
    </html>
    `;

    res.writeHead(statusCode, { "Content-Type": "text/html" });
    res.end(html);
}
