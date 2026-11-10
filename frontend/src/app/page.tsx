
"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { apiRequest } from "@/lib/api";

type DocumentItem = {
  id: string;
  name: string;
  category: string;
  encrypted: boolean;
  created_at: string;
};

type PermissionItem = {
  user_id: string;
  email: string;
  permission: string;
};

export default function Home() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  // Document sharing state
  const [sharingDoc, setSharingDoc] = useState<DocumentItem | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState("read");
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [sharing, setSharing] = useState(false);

  async function loadDocuments(accessToken: string) {
    const response = await apiRequest("/api/v1/documents/", accessToken);
    const data: DocumentItem[] = await response.json();
    setDocuments(data);
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed");
      }

      setToken(data.access_token);
      await loadDocuments(data.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setToken("");
    } finally {
      setLoading(false);
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: fullName.trim(),
            email: email.trim(),
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.detail)
          ? data.detail.map((item: { msg: string }) => item.msg).join(", ")
          : data.detail || "Registration failed";

        throw new Error(message);
      }

      setIsRegistering(false);
      setPassword("");
      setFullName("");
      setNotice("Account created successfully! Please sign in.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  }

  async function uploadDocument(file: File) {
    if (!token) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", "General");

    setLoading(true);
    setError("");
    setNotice("");

    try {
      await apiRequest("/api/v1/documents/upload", token, {
        method: "POST",
        body: formData,
      });

      await loadDocuments(token);
      setNotice("Document uploaded and secured successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function downloadDocument(doc: DocumentItem) {
    setError("");
    setNotice("");

    try {
      const response = await apiRequest(
        `/api/v1/documents/${doc.id}/download`,
        token
      );

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Document downloaded successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  }

  // Open sharing window and load existing permissions
  async function openShare(doc: DocumentItem) {
    setSharingDoc(doc);
    setShareEmail("");
    setSharePermission("read");
    setPermissions([]);
    setError("");
    setNotice("");

    try {
      const response = await apiRequest(
        `/api/v1/documents/${doc.id}/permissions`,
        token
      );

      const data = await response.json();
      setPermissions(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load sharing permissions"
      );
    }
  }

  // Share document with another registered user
  async function shareDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sharingDoc) return;

    setSharing(true);
    setError("");
    setNotice("");

    try {
      const formData = new FormData();
      formData.append("email", shareEmail.trim());
      formData.append("permission", sharePermission);

      await apiRequest(
        `/api/v1/documents/${sharingDoc.id}/permissions`,
        token,
        {
          method: "POST",
          body: formData,
        }
      );

      setNotice(`Document shared successfully with ${shareEmail.trim()}.`);
      setShareEmail("");

      const response = await apiRequest(
        `/api/v1/documents/${sharingDoc.id}/permissions`,
        token
      );

      const data = await response.json();
      setPermissions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sharing failed");
    } finally {
      setSharing(false);
    }
  }

  // Revoke an existing user's document access
  async function revokeAccess(userId: string) {
    if (!sharingDoc) return;

    setError("");
    setNotice("");

    try {
      await apiRequest(
        `/api/v1/documents/${sharingDoc.id}/permissions/${userId}`,
        token,
        { method: "DELETE" }
      );

      setPermissions((previous) =>
        previous.filter((permission) => permission.user_id !== userId)
      );

      setNotice("Document access revoked successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not revoke access"
      );
    }
  }

  function logout() {
    setToken("");
    setPassword("");
    setDocuments([]);
    setSharingDoc(null);
    setPermissions([]);
    setError("");
    setNotice("");
  }

  const filteredDocuments = documents.filter((doc) =>
    doc.name.toLowerCase().includes(search.toLowerCase())
  );

  // Login and registration screen
  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <form
          onSubmit={isRegistering ? register : login}
          className="w-full max-w-md space-y-5 rounded-2xl bg-white p-8 shadow-lg"
        >
          <h1 className="text-3xl font-bold text-blue-700">
            TrustVault
          </h1>

          <p className="text-slate-500">
            Secure document management
          </p>

          <h2 className="text-xl font-semibold text-slate-800">
            {isRegistering ? "Create your account" : "Welcome back"}
          </h2>

          {isRegistering && (
            <input
              type="text"
              required
              minLength={2}
              maxLength={150}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Full name"
              className="w-full rounded-xl border p-3"
            />
          )}

          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            className="w-full rounded-xl border p-3"
          />

          <input
            type="password"
            required
            minLength={isRegistering ? 12 : undefined}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={
              isRegistering
                ? "Password (minimum 12 characters)"
                : "Password"
            }
            className="w-full rounded-xl border p-3"
          />

          {notice && (
            <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
              {notice}
            </p>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-700 p-3 font-semibold text-white disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : isRegistering
                ? "Create account"
                : "Sign in"}
          </button>

          <p className="text-center text-sm text-slate-600">
            {isRegistering
              ? "Already have an account?"
              : "Don't have an account?"}{" "}
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError("");
                setNotice("");
                setPassword("");
              }}
              className="font-semibold text-blue-700 hover:underline"
            >
              {isRegistering ? "Sign in" : "Register"}
            </button>
          </p>
        </form>
      </main>
    );
  }

  // Main dashboard
  return (
    <main className="min-h-screen bg-slate-100 text-slate-800 md:flex">
      <aside className="bg-white p-6 md:min-h-screen md:w-64">
        <h1 className="mb-3 text-2xl font-bold text-blue-700">
          TrustVault
        </h1>

        <p className="mb-10 text-xs text-slate-400">
          Secure document management
        </p>

        <p className="rounded-xl bg-blue-50 p-3 font-semibold text-blue-700">
          My Documents
        </p>

        <div className="mt-8 rounded-xl bg-green-50 p-4 text-sm text-green-700">
          AES-256-GCM encryption enabled
        </div>

        <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
          <p className="font-semibold">Secure sharing</p>
          <p className="mt-1 text-xs">
            Control who can access your documents.
          </p>
        </div>

        <button
          onClick={logout}
          className="mt-8 text-sm text-red-600"
        >
          Sign out
        </button>
      </aside>

      <section className="min-w-0 flex-1 p-6 md:p-10">
        <header className="mb-8">
          <h2 className="text-3xl font-bold">My Documents</h2>
          <p className="mt-2 text-slate-500">
            Your secure files, all in one place.
          </p>
        </header>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total Documents</p>
            <p className="mt-2 text-3xl font-bold">{documents.length}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Encrypted Documents</p>
            <p className="mt-2 text-3xl font-bold">
              {documents.filter((doc) => doc.encrypted).length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Security</p>
            <p className="mt-2 text-xl font-bold text-green-600">
              Protected
            </p>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your documents..."
            className="w-full max-w-md rounded-xl border bg-white p-3"
          />

          <label className="cursor-pointer rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white">
            Upload document
            <input
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadDocument(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">
            {error}
          </p>
        )}

        {notice && (
          <p className="mb-4 rounded-xl bg-green-50 p-3 text-green-700">
            {notice}
          </p>
        )}

        {loading && (
          <p className="mb-4 text-sm text-blue-600">Loading...</p>
        )}

        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-5">Document</th>
                <th className="p-5">Category</th>
                <th className="p-5">Date uploaded</th>
                <th className="p-5">Security</th>
                <th className="p-5">Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredDocuments.map((doc) => (
                <tr key={doc.id} className="border-t hover:bg-slate-50">
                  <td className="p-5 font-semibold">{doc.name}</td>
                  <td className="p-5">{doc.category}</td>
                  <td className="p-5">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-5">
                    {doc.encrypted ? "Encrypted" : "Not encrypted"}
                  </td>
                  <td className="p-5">
                    <div className="flex gap-4">
                      <button
                        onClick={() => void downloadDocument(doc)}
                        className="font-semibold text-blue-700 hover:underline"
                      >
                        Download
                      </button>

                      <button
                        onClick={() => void openShare(doc)}
                        className="font-semibold text-emerald-700 hover:underline"
                      >
                        Share
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredDocuments.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-10 text-center text-slate-500"
                  >
                    No documents found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Document sharing modal */}
        {sharingDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-xl font-bold">Share document</h3>

                <button
                  type="button"
                  onClick={() => {
                    setSharingDoc(null);
                    setPermissions([]);
                    setError("");
                    setNotice("");
                  }}
                  className="text-2xl text-slate-500"
                  aria-label="Close sharing window"
                >
                  ×
                </button>
              </div>

              <p className="mb-4 text-sm text-slate-500">
                Sharing: <strong>{sharingDoc.name}</strong>
              </p>

              <p className="mb-4 text-sm text-slate-500">
                Sharing: <strong>{sharingDoc.name}</strong>
              </p>

              {error && (
                <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              {notice && (
                <p className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                  {notice}
                </p>
              )}

              <form onSubmit={shareDocument} className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  Recipient email
                </label>

                <input
                  type="email"
                  required
                  value={shareEmail}
                  onChange={(event) => setShareEmail(event.target.value)}
                  placeholder="Enter registered user's email"
                  className="w-full rounded-xl border p-3"
                />

                <label className="block text-sm font-medium text-slate-700">
                  Access permission
                </label>

                <select
                  value={sharePermission}
                  onChange={(event) => setSharePermission(event.target.value)}
                  className="w-full rounded-xl border p-3"
                >
                  <option value="read">Read access</option>
                  <option value="edit">Edit access</option>
                </select>

                <button
                  type="submit"
                  disabled={sharing || !shareEmail.trim()}
                  className="w-full rounded-xl bg-blue-700 p-3 font-semibold text-white disabled:opacity-50"
                >
                  {sharing ? "Sharing..." : "Share securely"}
                </button>
              </form>

              <div className="mt-6 border-t pt-5">
                <h4 className="mb-3 font-semibold">
                  People with access
                </h4>

                {permissions.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No one else has access yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {permissions.map((permission) => (
                      <div
                        key={permission.user_id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {permission.email}
                          </p>

                          <p className="text-xs capitalize text-slate-500">
                            {permission.permission} access
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void revokeAccess(permission.user_id)}
                          className="shrink-0 text-sm font-semibold text-red-600 hover:underline"
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="mt-5 text-xs text-slate-400">
                Only the document owner can manage sharing permissions.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
