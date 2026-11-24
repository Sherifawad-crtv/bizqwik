import { auth } from "../../../shared/api/backend";
import { callFn } from "../../../shared/api/core";
import { supabase } from "../../../shared/api/supabaseClient";
import { extOf } from "../../../shared/platform/image";
import type { Profile } from "../../../shared/types";

// Data layer: the server calls the account screens make. Profile updates and
// the avatar upload are account-only; the auth client is shared and wrapped.
export const accountRepository = {
  updateName: (name: string) => callFn<{ profile: Profile }>("me/update", { method: "POST", body: { name } }),
  updateAvatar: (avatarUrl: string | null) => callFn<{ profile: Profile }>("me/update", { method: "POST", body: { avatarUrl } }),
  /** Uploads a profile photo and returns its public URL. */
  uploadAvatar: async (userId: string, blob: Blob): Promise<string> => {
    const path = `${userId}/avatar.${extOf(blob)}`;
    const { error } = await supabase.storage.from("avatars").upload(path, blob, {
      upsert: true,
      contentType: blob.type,
      cacheControl: "3600",
    });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    // Cache-bust — re-uploading keeps the same path, so without this a browser
    // that already cached the old image at that URL would keep showing it.
    return `${data.publicUrl}?t=${Date.now()}`;
  },
  signInWithPassword: (email: string, password: string) => auth.signInWithPassword(email, password),
  updatePassword: (password: string) => auth.updatePassword(password),
};
