"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const service = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
);

async function verifyOwnership(venueId: string) {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: owner } = await service
        .from("venue_owners")
        .select("id")
        .eq("user_id", user.id)
        .eq("venue_id", venueId)
        .single();

    return owner ? user : null;
}

export async function uploadGalleryImage(venueId: string, formData: FormData) {
    const user = await verifyOwnership(venueId);
    if (!user) return { error: "Not authorized" };

    const file = formData.get("file") as File;
    if (!file) return { error: "No file uploaded" };

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${venueId}/gallery/${Date.now()}.${ext}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await service
        .storage
        .from("venue-assets")
        .upload(fileName, file, { upsert: false, contentType: file.type });

    if (uploadError) return { error: uploadError.message };

    // Get the public URL
    const { data: { publicUrl } } = service
        .storage
        .from("venue-assets")
        .getPublicUrl(uploadData.path);

    // Get the next sort order
    const { data: existing } = await service
        .from("venue_gallery")
        .select("sort_order")
        .eq("venue_id", venueId)
        .order("sort_order", { ascending: false })
        .limit(1);

    const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order || 0) + 1 : 0;

    // Insert gallery row
    const caption = (formData.get("caption") as string) || null;
    const { error: insertError } = await service
        .from("venue_gallery")
        .insert({ venue_id: venueId, image_url: publicUrl, caption, sort_order: nextOrder });

    if (insertError) return { error: insertError.message };

    revalidatePath("/edit");
    return { ok: true, url: publicUrl };
}

export async function deleteGalleryImage(venueId: string, imageId: string) {
    const user = await verifyOwnership(venueId);
    if (!user) return { error: "Not authorized" };

    // Get the image record first
    const { data: img } = await service
        .from("venue_gallery")
        .select("image_url")
        .eq("id", imageId)
        .eq("venue_id", venueId)
        .single();

    if (!img) return { error: "Image not found" };

    // Try to delete from storage if it's a Supabase URL
    if (img.image_url.includes("supabase.co")) {
        const path = img.image_url.split("/venue-assets/")[1];
        if (path) {
            await service.storage.from("venue-assets").remove([path]);
        }
    }

    // Delete the DB row
    const { error } = await service
        .from("venue_gallery")
        .delete()
        .eq("id", imageId);

    if (error) return { error: error.message };

    revalidatePath("/edit");
    return { ok: true };
}

export async function updateHeroImage(venueId: string, formData: FormData) {
    const user = await verifyOwnership(venueId);
    if (!user) return { error: "Not authorized" };

    const file = formData.get("file") as File;
    if (!file) return { error: "No file uploaded" };

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${venueId}/hero.${ext}`;

    // Upload (upsert to overwrite existing hero)
    const { data: uploadData, error: uploadError } = await service
        .storage
        .from("venue-assets")
        .upload(fileName, file, { upsert: true, contentType: file.type });

    if (uploadError) return { error: uploadError.message };

    const { data: { publicUrl } } = service
        .storage
        .from("venue-assets")
        .getPublicUrl(uploadData.path);

    // Update venue_pages
    const { error } = await service
        .from("venue_pages")
        .update({ hero_image: publicUrl })
        .eq("venue_id", venueId);

    if (error) return { error: error.message };

    revalidatePath("/edit");
    return { ok: true, url: publicUrl };
}

export async function removeHeroImage(venueId: string) {
    const user = await verifyOwnership(venueId);
    if (!user) return { error: "Not authorized" };

    const { error } = await service
        .from("venue_pages")
        .update({ hero_image: null })
        .eq("venue_id", venueId);

    if (error) return { error: error.message };

    revalidatePath("/edit");
    return { ok: true };
}

export async function reorderGallery(venueId: string, orderedIds: string[]) {
    const user = await verifyOwnership(venueId);
    if (!user) return { error: "Not authorized" };

    // Update sort_order for each image
    for (let i = 0; i < orderedIds.length; i++) {
        await service
            .from("venue_gallery")
            .update({ sort_order: i })
            .eq("id", orderedIds[i])
            .eq("venue_id", venueId);
    }

    revalidatePath("/edit");
    return { ok: true };
}

export async function getGalleryImages(venueId: string) {
    const { data, error } = await service
        .from("venue_gallery")
        .select("id, image_url, caption, sort_order")
        .eq("venue_id", venueId)
        .order("sort_order", { ascending: true });

    if (error) return { error: error.message, images: [] };
    return { images: data || [] };
}
