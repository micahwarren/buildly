import { Capacitor } from "@capacitor/core";
export const isNativeApp = () => Capacitor.isNativePlatform();
export async function nativePhoto(
  source: "camera" | "photos",
): Promise<File | undefined> {
  const { Camera, CameraResultType, CameraSource } =
    await import("@capacitor/camera");
  try {
    const photo = await Camera.getPhoto({
      source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
      resultType: CameraResultType.Base64,
      quality: 85,
      width: 1600,
      height: 1600,
      correctOrientation: true,
    });
    if (!photo.base64String)
      throw new Error("No photo was returned. Please choose another photo.");
    const bytes = Uint8Array.from(atob(photo.base64String), (c) =>
      c.charCodeAt(0),
    );
    return new File([bytes], `photo.${photo.format}`, {
      type: `image/${photo.format === "jpg" ? "jpeg" : photo.format}`,
    });
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Could not open photos. Check photo and camera access in iPhone Settings.";
    if (/cancel/i.test(message)) return;
    throw new Error(message);
  }
}
export async function exportFile(name: string, text: string, type: string) {
  if (isNativeApp()) {
    const { Filesystem, Directory, Encoding } =
      await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const file = await Filesystem.writeFile({
      path: name,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    try {
      await Share.share({ title: "Buildly project", url: file.uri });
    } finally {
      await Filesystem.deleteFile({
        path: name,
        directory: Directory.Cache,
      }).catch(() => {});
    }
  } else {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
