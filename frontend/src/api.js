const API = "http://10.120.5.132:8000" //this must be changed due to idk what happend in that stupid POS pc

// Global logout callback wordt ingesteld door App.jsx
let onGlobalLogout = null
export const setLogoutCallback = (cb) => { onGlobalLogout = cb }

// Helper: verwerkt auth errors consistent
const handleAuthError = async (res) => {
    if (res.status === 401) {
        onGlobalLogout?.()
        throw new Error("Sessie verlopen. Log opnieuw in.")
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Server error ${res.status}`)
    }
    return res
}

// Authenticated fetch wrapper
export const apiFetch = async (endpoint, options = {}) => {
    const token = localStorage.getItem("cms_token")

    const res = await fetch(API + endpoint, {
        ...options,
        headers: {
            ...(options.headers || {}),
            "Authorization": token ? `Bearer ${token}` : "",
            ...(options.body instanceof FormData
                ? {}
                : { "Content-Type": "application/json" }),
        },
    })

    return handleAuthError(res)
}

// Login endpoint (geen token nodig)
export const login = async (username, password) => {
    const res = await fetch(API + "/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Inloggen mislukt.")
    }

    const data = await res.json()
    if (!data.token) throw new Error("Geen token ontvangen.")

    return data.token
}

// Helper: decode JWT payload om expiration te checken (frontend hint)
export const decodeToken = (token) => {
    try {
        const payload = token.split(".")[1]
        if (!payload) return null
        const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
        return decoded
    } catch {
        return null
    }
}