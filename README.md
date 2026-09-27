# Submersive Isle Overlay v1.0.0

## Secure server connection

The public overlay does not contain the game server RCON password or RCON client. Live player data is requested from the Submersive Isle backend API after the user signs in through Steam.

`resources/app/api-config.json` contains only the public API base URL. It must never contain RCON credentials, JWT signing secrets, or the internal API key.

Before publishing a member build, set `baseUrl` to the HTTPS address of the deployed Submersive Isle API. `http://localhost:3000` is for local development only.

Steam authentication is required each time the application starts. The authenticated SteamID returned by the backend is used for player telemetry; users cannot verify themselves by typing an arbitrary SteamID.
