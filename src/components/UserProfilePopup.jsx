import { useState } from "react";
import { pickColor, initialsFromName } from "../utils/helpers";
import { api, API_URL } from "../utils/api";

export default function UserProfilePopup({ user, isOwnProfile, token, onClose, onProfileUpdated }) {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user.username || "");
  const [bio, setBio] = useState(user.bio || "");
  const [bannerColor, setBannerColor] = useState(user.banner_color || "#5865f2");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await api("/users/me", {
        method: "PUT",
        body: { username: username || undefined, bio, banner_color: bannerColor },
        token,
      });
      if (onProfileUpdated) onProfileUpdated(updated);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      const updated = await api("/users/me", {
        method: "PUT",
        body: { avatar_url: url },
        token,
      });
      if (onProfileUpdated) onProfileUpdated(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <>
      <button type="button" className="scrim modal-scrim" onClick={onClose} aria-label="Close profile" />
      <div className="profile-popup-overlay">
        <div className="profile-popup">
          <div className="profile-banner" style={{ background: user.banner_color || bannerColor }}>
            {isOwnProfile && editing ? (
              <input
                type="color"
                className="banner-color-picker"
                value={bannerColor}
                onChange={(e) => setBannerColor(e.target.value)}
              />
            ) : null}
          </div>
          <div className="profile-popup-body">
            <div className="profile-avatar-section">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.username} className="profile-avatar-img" />
              ) : (
                <span className="profile-avatar-fallback" style={{ background: pickColor(user.username) }}>
                  {initialsFromName(user.username)}
                </span>
              )}
              {isOwnProfile ? (
                <label className="avatar-upload-label">
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
                  {uploadingAvatar ? "..." : "Edit"}
                </label>
              ) : null}
            </div>

            {editing ? (
              <div className="profile-edit-form">
                <label className="profile-edit-label">
                  Username
                  <input value={username} onChange={(e) => setUsername(e.target.value)} className="profile-edit-input" />
                </label>
                <label className="profile-edit-label">
                  About Me
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="profile-edit-textarea" maxLength={200} rows={3} placeholder="Tell the world about yourself..." />
                </label>
                {error ? <span className="form-error">{error}</span> : null}
                <div className="profile-edit-actions">
                  <button type="button" className="chip" onClick={() => setEditing(false)}>Cancel</button>
                  <button type="button" className="chip solid" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="profile-details">
                <h3 className="profile-display-name">{user.username}</h3>
                {user.bio ? <p className="profile-bio">{user.bio}</p> : <p className="muted profile-bio">No bio set</p>}
                {isOwnProfile ? (
                  <button type="button" className="chip" onClick={() => setEditing(true)}>Edit Profile</button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
