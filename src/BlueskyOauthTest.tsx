import React, { useState, useEffect } from "react";
import { Agent } from "@atproto/api";
import {
  BrowserOAuthClient,
  OAuthSession,
} from "@atproto/oauth-client-browser";
import type { ProfileViewDetailed } from "@atproto/api/dist/client/types/app/bsky/actor/defs";

const SCOPES = "atproto repo:app.piano.user.lesson?action=create";
const CLIENT_URI = "http://127.0.0.1:5173/";
const REDIRECT_URI = CLIENT_URI;

const client = new BrowserOAuthClient({
  clientMetadata: {
    client_id: `http://localhost?redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`,
    client_name: "My Local Bluesky App",
    client_uri: CLIENT_URI,
    redirect_uris: [REDIRECT_URI],
    scope: SCOPES,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    application_type: "web",
    dpop_bound_access_tokens: true,
  },
  handleResolver: "https://bsky.social", // Default resolver
});

// Define your custom record schema
interface LessonRecord {
  lessonId: string;
  completedAt: string;
  score: number;
  notes?: string;
}

// Your custom collection namespace
const LESSON_COLLECTION = "app.piano.user.lesson";

function BlueskyApp() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [session, setSession] = useState<OAuthSession | null>(null);
  const [profile, setProfile] = useState<ProfileViewDetailed | null>(null);
  const [lessons, setLessons] = useState<any[]>([]);

  // Login form state
  const [identifier, setIdentifier] = useState("whoisryosuke.bsky.social");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const createAgent = (session: OAuthSession) => {
    const newAgent = new Agent(session);
    setAgent(newAgent);
  };

  useEffect(() => {
    // Check if we are returning from an OAuth redirect
    const initAuth = async () => {
      try {
        const result = await client.init();
        if (result?.session) {
          createAgent(result.session);
          setSession(result.session);

          // Fetch user profile
          if (!agent) return;
          const profileRes = await agent.getProfile({
            actor: result.session.did,
          });
          setProfile(profileRes.data);
        }
      } catch (err) {
        console.error("Auth initialization failed:", err);
      }
    };
    initAuth();
  }, []);

  // 1. LOGIN FUNCTION
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    setLoading(true);
    setError("");

    try {
      // Login and get session
      const session = await client.signInPopup(identifier);
      createAgent(session);

      console.log("got oauth session", session);
      setSession(session);
    } catch (err: any) {
      setError(err.message || "Login failed");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    setSession(null);
    setAgent(null);
    localStorage.removeItem("bsky-session");

    // Reinitialize agent
    const newAgent = new Agent({
      service: "https://bsky.social",
    });
    setAgent(newAgent);
  };

  // 2. SAVE DATA TO CUSTOM COLLECTION
  const saveLesson = async (lessonData: LessonRecord) => {
    if (!agent || !session) {
      console.error("Not logged in");
      return;
    }

    try {
      // Create a record in your custom collection
      const response = await agent.com.atproto.repo.createRecord({
        repo: session.did, // User's DID
        collection: LESSON_COLLECTION, // Your custom namespace
        record: {
          $type: LESSON_COLLECTION,
          ...lessonData,
          createdAt: new Date().toISOString(),
        },
      });

      console.log("Lesson saved!", response);
      console.log("Record URI:", response.data.uri);
      console.log("Record CID:", response.data.cid);

      // Refresh lessons list
      await fetchLessons();

      return response;
    } catch (err) {
      console.error("Error saving lesson:", err);
      throw err;
    }
  };

  // 3. READ DATA FROM CUSTOM COLLECTION
  const fetchLessons = async () => {
    if (!agent || !session) {
      console.error("Not logged in");
      return;
    }

    try {
      // List records from your custom collection
      const response = await agent.com.atproto.repo.listRecords({
        repo: session.did,
        collection: LESSON_COLLECTION,
        limit: 100,
      });

      console.log("Fetched lessons:", response.data.records);
      setLessons(response.data.records);

      return response.data.records;
    } catch (err) {
      console.error("Error fetching lessons:", err);
      throw err;
    }
  };

  // Example: Add a test lesson
  const addTestLesson = async () => {
    await saveLesson({
      lessonId: `lesson-${Date.now()}`,
      completedAt: new Date().toISOString(),
      score: Math.floor(Math.random() * 100),
      notes: "Test lesson from React app",
    });
  };

  // Delete a lesson
  const deleteLesson = async (rkey: string) => {
    if (!agent || !session) return;

    try {
      await agent.com.atproto.repo.deleteRecord({
        repo: session.did,
        collection: LESSON_COLLECTION,
        rkey: rkey, // The record key from the URI
      });

      await fetchLessons();
    } catch (err) {
      console.error("Error deleting lesson:", err);
    }
  };

  // UI
  if (!session) {
    return (
      <div style={{ padding: "20px", maxWidth: "400px", margin: "0 auto" }}>
        <h1>Login to Bluesky</h1>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "10px" }}>
            <input
              type="text"
              placeholder="Username or email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              style={{ width: "100%", padding: "8px" }}
            />
          </div>
          {error && (
            <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{ padding: "10px 20px" }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1>Piano Lesson Tracker</h1>
        <button onClick={handleLogout} style={{ padding: "8px 16px" }}>
          Logout
        </button>
      </div>

      <div
        style={{
          marginBottom: "20px",
          padding: "10px",
          backgroundColor: "#f0f0f0",
          borderRadius: "4px",
        }}
      >
        {/* <strong>Logged in as:</strong> {session.handle} */}
        <br />
        <strong>DID:</strong> <code>{session.did}</code>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={addTestLesson}
          style={{ padding: "10px 20px", marginRight: "10px" }}
        >
          Add Test Lesson
        </button>
        <button onClick={fetchLessons} style={{ padding: "10px 20px" }}>
          Refresh Lessons
        </button>
      </div>

      <h2>Your Lessons ({lessons.length})</h2>
      {lessons.length === 0 ? (
        <p>No lessons yet. Click "Add Test Lesson" to create one.</p>
      ) : (
        <div>
          {lessons.map((record) => {
            // Extract the rkey from the URI (format: at://did/collection/rkey)
            const rkey = record.uri.split("/").pop();

            return (
              <div
                key={record.uri}
                style={{
                  border: "1px solid #ddd",
                  padding: "15px",
                  marginBottom: "10px",
                  borderRadius: "4px",
                }}
              >
                <div>
                  <strong>Lesson ID:</strong> {record.value.lessonId}
                </div>
                <div>
                  <strong>Score:</strong> {record.value.score}
                </div>
                <div>
                  <strong>Completed:</strong>{" "}
                  {new Date(record.value.completedAt).toLocaleString()}
                </div>
                {record.value.notes && (
                  <div>
                    <strong>Notes:</strong> {record.value.notes}
                  </div>
                )}
                <div
                  style={{ marginTop: "10px", fontSize: "12px", color: "#666" }}
                >
                  <strong>URI:</strong> <code>{record.uri}</code>
                </div>
                <button
                  onClick={() => deleteLesson(rkey!)}
                  style={{
                    marginTop: "10px",
                    padding: "5px 10px",
                    backgroundColor: "#ff4444",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default BlueskyApp;
