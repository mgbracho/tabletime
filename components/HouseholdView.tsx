"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useHouseholdProfile } from "@/lib/hooks/use-household-profile";
import { useLanguage } from "@/lib/i18n";
import { DIETARY_RESTRICTION_OPTIONS } from "@/lib/constants";

export function HouseholdView() {
  const { user, householdId } = useAuth();
  const { householdName, members, setHouseholdName, updateMember, addMember, loading } =
    useHouseholdProfile(householdId, user?.id ?? null);
  const { t } = useLanguage();
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopyFeedback, setShareCopyFeedback] = useState(false);
  const [showAddNoApp, setShowAddNoApp] = useState(false);
  const [addNoAppName, setAddNoAppName] = useState("");
  const [addNoAppServings, setAddNoAppServings] = useState(1);
  const [addNoAppLoading, setAddNoAppLoading] = useState(false);
  const [addNoAppError, setAddNoAppError] = useState<string | null>(null);

  if (loading) return <p className="text-sm text-zinc-500">{t("hh.loading")}</p>;

  if (!householdId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-6 text-sm text-amber-800">
        {t("hh.signIn")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-teal-200 bg-teal-50/50 px-4 py-3">
        <label className="mb-1 block text-xs font-medium text-teal-800">{t("hh.householdName")}</label>
        <input
          type="text"
          value={householdName}
          onChange={(e) => setHouseholdName(e.target.value)}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== householdName) setHouseholdName(v);
          }}
          className="w-full max-w-xs rounded-lg border border-teal-200 px-3 py-2 text-sm text-teal-900 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
          placeholder={t("hh.householdPlaceholder")}
        />
      </div>

      <div className="rounded-xl border-l-4 border-l-teal-600 border border-teal-200 bg-teal-50/60 p-4">
        <h3 className="mb-2 text-sm font-semibold text-teal-800">{t("hh.addMembers")}</h3>
        <p className="mb-3 text-xs text-zinc-600">{t("hh.inviteDesc")}</p>
        {!inviteLink ? (
          <button
            type="button"
            disabled={inviteLoading}
            onClick={async () => {
              setInviteLoading(true);
              try {
                const res = await fetch("/api/household/invite", { method: "POST", credentials: "include" });
                const data = await res.json();
                setInviteLink(res.ok && data.link ? data.link : t("hh.linkError"));
              } catch {
                setInviteLink(t("hh.connError"));
              }
              setInviteLoading(false);
            }}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-70"
          >
            {inviteLoading ? t("hh.generating") : t("hh.generateInvite")}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="min-w-0 flex-1 rounded border border-teal-200 bg-white px-3 py-2 text-xs text-zinc-700"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(inviteLink);
                setCopyFeedback(true);
                setTimeout(() => setCopyFeedback(false), 2000);
              }}
              className="rounded-lg border border-teal-200 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50"
            >
              {copyFeedback ? t("hh.copied") : t("hh.copy")}
            </button>
            <button
              type="button"
              onClick={() => setInviteLink(null)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              {t("hh.close")}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border-l-4 border-l-teal-400 border border-teal-200 bg-teal-300/10 p-4">
        <h3 className="mb-2 text-sm font-semibold text-teal-800">{t("hh.shareTitle")}</h3>
        <p className="mb-3 text-xs text-zinc-600">{t("hh.shareDesc")}</p>
        {!shareLink ? (
          <button
            type="button"
            disabled={shareLoading}
            onClick={async () => {
              setShareLoading(true);
              try {
                const res = await fetch("/api/household/share", { method: "POST", credentials: "include" });
                const data = await res.json();
                setShareLink(res.ok && data.link ? data.link : t("hh.linkError"));
              } catch {
                setShareLink(t("hh.connError"));
              }
              setShareLoading(false);
            }}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-70"
          >
            {shareLoading ? t("hh.generating") : t("hh.generateShare")}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareLink}
              className="min-w-0 flex-1 rounded border border-teal-200 bg-white px-3 py-2 text-xs text-zinc-700"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(shareLink);
                setShareCopyFeedback(true);
                setTimeout(() => setShareCopyFeedback(false), 2000);
              }}
              className="rounded-lg border border-teal-200 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50"
            >
              {shareCopyFeedback ? t("hh.copied") : t("hh.copy")}
            </button>
            <button
              type="button"
              onClick={() => setShareLink(null)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              {t("hh.close")}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border-l-4 border-l-amber-600 border border-teal-200 bg-amber-50/60 p-4">
        <h3 className="mb-3 text-sm font-semibold text-teal-800">{t("hh.membersTitle")}</h3>
        <p className="mb-2 text-xs text-zinc-500">{t("hh.membersInfo")}</p>
        <p className="mb-2 text-xs text-zinc-500">{t("hh.membersNoApp")}</p>
        {!showAddNoApp ? (
          <button
            type="button"
            onClick={() => { setShowAddNoApp(true); setAddNoAppError(null); setAddNoAppName(""); setAddNoAppServings(1); }}
            className="mb-4 rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100"
          >
            {t("hh.addNoApp")}
          </button>
        ) : (
          <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50/50 p-4">
            <p className="mb-3 text-xs font-medium text-teal-800">{t("hh.addNoAppTitle")}</p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">{t("hh.name")}</label>
                <input
                  type="text"
                  value={addNoAppName}
                  onChange={(e) => setAddNoAppName(e.target.value)}
                  placeholder={t("hh.namePlaceholder")}
                  className="w-40 rounded border border-teal-200 px-2 py-1.5 text-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">{t("hh.servings")}</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={addNoAppServings}
                  onChange={(e) => { const n = parseInt(e.target.value, 10); if (!isNaN(n)) setAddNoAppServings(n); }}
                  className="w-14 rounded border border-teal-200 px-2 py-1.5 text-center text-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={addNoAppLoading}
                  onClick={async () => {
                    setAddNoAppError(null);
                    setAddNoAppLoading(true);
                    try {
                      await addMember(addNoAppName.trim() || undefined, addNoAppServings);
                      setShowAddNoApp(false);
                      setAddNoAppName("");
                      setAddNoAppServings(1);
                    } catch (e) {
                      setAddNoAppError(e instanceof Error ? e.message : t("hh.addError"));
                    } finally {
                      setAddNoAppLoading(false);
                    }
                  }}
                  className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-70"
                >
                  {addNoAppLoading ? t("hh.adding") : t("hh.add")}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddNoApp(false); setAddNoAppError(null); }}
                  className="rounded-lg border border-teal-200 px-3 py-1.5 text-sm text-teal-700 hover:bg-teal-100"
                >
                  {t("hh.cancel")}
                </button>
              </div>
            </div>
            {addNoAppError && <p className="mt-2 text-xs text-red-600">{addNoAppError}</p>}
          </div>
        )}
        <p className="mb-4 text-xs text-zinc-500">{t("hh.membersDesc")}</p>
        <ul className="space-y-3">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap gap-4 rounded-xl border-l-4 border-l-teal-400 border border-teal-200 bg-teal-50/40 p-4 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-zinc-500">
                  {member.is_current_user ? t("hh.you") : t("hh.member")}
                </span>
                <input
                  type="text"
                  value={draftNames[member.id] ?? member.display_name ?? member.email ?? ""}
                  onChange={(e) => setDraftNames((prev) => ({ ...prev, [member.id]: e.target.value }))}
                  onBlur={() => {
                    const v = (draftNames[member.id] ?? member.display_name ?? member.email ?? "").trim() || null;
                    if (v !== (member.display_name ?? null)) updateMember(member.id, { display_name: v });
                    setDraftNames((prev) => { const next = { ...prev }; delete next[member.id]; return next; });
                  }}
                  placeholder={t("hh.nameInHome")}
                  className="mt-1 w-full max-w-[200px] rounded border border-teal-200 px-2 py-1.5 text-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-zinc-500">{t("hh.servings")}</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={member.default_servings}
                  onChange={(e) => { const n = parseInt(e.target.value, 10); if (!isNaN(n)) updateMember(member.id, { default_servings: n }); }}
                  className="w-14 rounded border border-teal-200 px-2 py-1.5 text-center text-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
              </div>
              <div className="w-full border-t border-teal-100 pt-3 sm:w-auto sm:border-t-0 sm:pt-0">
                <span className="block text-xs font-medium text-zinc-500 mb-1.5">{t("hh.dietary")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {DIETARY_RESTRICTION_OPTIONS.map((tag) => {
                    const active = member.dietary_restrictions.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const next = active
                            ? member.dietary_restrictions.filter((tg) => tg !== tag)
                            : [...member.dietary_restrictions, tag];
                          updateMember(member.id, { dietary_restrictions: next });
                        }}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                          active ? "bg-teal-600 text-white" : "bg-teal-100 text-teal-700 hover:bg-teal-200"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
