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

export default function Home() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("owner@test.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function loadDocuments(accessToken: string) {
    const response = await apiRequest("/api/v1/documents/", accessToken);
    const data: DocumentItem[] = await response.json();
    setDocuments(data);
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

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

    try {
      await apiRequest("/api/v1/documents/upload", token, {
        method: "POST",
        body: formData,
      });

      await loadDocuments(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function downloadDocument(doc: DocumentItem) {
    setError("");

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  }

  function logout() {
    setToken("");
    setPassword("");
    setDocuments([]);
    setError("");
  }

  const filteredDocuments = documents.filter((doc) =>
    doc.name.toLowerCase().includes(search.toLowerCase())
  );

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <form
          onSubmit={login}
          className="w-full max-w-md space-y-5 rounded-2xl bg-white p-8 shadow-lg"
        >
          <h1 className="text-3xl font-bold text-blue-700">TrustVault</h1>
          <p className="text-slate-500">Secure document management</p>

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
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="w-full rounded-xl border p-3"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-700 p-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-800 md:flex">
      <aside className="bg-white p-6 md:min-h-screen md:w-64">
        <h1 className="mb-3 text-2xl font-bold text-blue-700">TrustVault</h1>

        <p className="mb-10 text-xs text-slate-400">
          Secure document management
        </p>

        <p className="rounded-xl bg-blue-50 p-3 font-semibold text-blue-700">
          My Documents
        </p>

        <div className="mt-8 rounded-xl bg-green-50 p-4 text-sm text-green-700">
          AES-256-GCM encryption enabled
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
                    <button
                      onClick={() => void downloadDocument(doc)}
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      Download
                    </button>
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
      </section>
    </main>
  );
}
