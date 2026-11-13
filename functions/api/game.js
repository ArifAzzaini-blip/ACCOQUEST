export async function onRequestPost({ request, env }) {
    try {
        if (!env.GAS_WEBAPP_URL) {
            throw new Error("GAS_WEBAPP_URL belum ditetapkan.");
        }

        if (!env.ACCOQUEST_API_KEY) {
            throw new Error("ACCOQUEST_API_KEY belum ditetapkan.");
        }

        const incoming = await request.json();

        if (!incoming.action) {
            throw new Error("API action tidak dinyatakan.");
        }

        const allowedActions = [
            "createLobby",
            "joinLobby",
            "getGameState",
            "setReady",
            "startGame",
            "getQuestion",
            "submitAnswer",
            "chooseBlock",
            "spinPoints",
            "resetGame"
        ];

        if (!allowedActions.includes(incoming.action)) {
            throw new Error("API action tidak dibenarkan.");
        }

        const response = await fetch(env.GAS_WEBAPP_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                apiKey: env.ACCOQUEST_API_KEY,
                action: incoming.action,
                data: incoming.data || {}
            }),
            redirect: "follow"
        });

        const resultText = await response.text();

        let result;

        try {
            result = JSON.parse(resultText);
        } catch {
            throw new Error(
                "Google Apps Script memberikan respons bukan JSON."
            );
        }

        return new Response(JSON.stringify(result), {
            status: response.ok ? 200 : response.status,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store"
            }
        });

    } catch (error) {
        return new Response(
            JSON.stringify({
                ok: false,
                error: error.message || "Server error."
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );
    }
}
