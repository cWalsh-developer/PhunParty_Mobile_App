import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import { Image, ImageProps } from "react-native";

interface AuthenticatedImageProps extends Omit<ImageProps, "source"> {
  photoUrl: string;
}

/**
 * Component that loads images with authentication headers
 * Converts authenticated image URLs to base64 for React Native Image component
 */
export const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({
  photoUrl,
  ...imageProps
}) => {
  const [imageSource, setImageSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAuthenticatedImage = async () => {
      try {
        setLoading(true);

        // Check if this is a DiceBear avatar (public URL)
        if (photoUrl.includes("api.dicebear.com")) {
          // Convert SVG to PNG for React Native compatibility
          const pngUrl = photoUrl.replace("/svg?", "/png?");
          setImageSource(pngUrl);
          return;
        }

        // Get authentication headers for private images
        const apiKey = Constants.expoConfig?.extra?.API_KEY;
        const token = await SecureStore.getItemAsync("jwt");

        if (!apiKey) {
          setImageSource(photoUrl);
          return;
        }

        const headers: Record<string, string> = {
          "X-API-Key": apiKey,
        };

        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        // Construct full URL if it's a relative path
        const fullUrl = photoUrl.startsWith("http")
          ? photoUrl
          : `${Constants.expoConfig?.extra?.API_URL}${photoUrl}`;

        // Fetch the image with authentication
        const response = await fetch(fullUrl, {
          method: "GET",
          headers,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to load image: ${response.status} ${response.statusText}`
          );
        }

        // Convert response to base64 using React Native's base64 encoding
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        // Convert bytes to base64 string (React Native compatible)
        let base64 = "";
        const chars =
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

        for (let i = 0; i < bytes.length; i += 3) {
          const a = bytes[i];
          const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
          const c = i + 2 < bytes.length ? bytes[i + 2] : 0;

          const bitmap = (a << 16) | (b << 8) | c;

          base64 += chars.charAt((bitmap >> 18) & 63);
          base64 += chars.charAt((bitmap >> 12) & 63);
          base64 +=
            i + 1 < bytes.length ? chars.charAt((bitmap >> 6) & 63) : "=";
          base64 += i + 2 < bytes.length ? chars.charAt(bitmap & 63) : "=";
        }

        const mimeType = response.headers.get("content-type") || "image/jpeg";
        const dataUri = `data:${mimeType};base64,${base64}`;

        setImageSource(dataUri);
      } catch (error) {
        console.error("AuthenticatedImage: Failed to load image:", error);
        setImageSource(null);
      } finally {
        setLoading(false);
      }
    };

    if (photoUrl) {
      loadAuthenticatedImage();
    }
  }, [photoUrl]);

  if (loading) {
    return (
      <Image {...imageProps} source={require("@/assets/images/icon.png")} />
    );
  }

  if (!imageSource) {
    return (
      <Image {...imageProps} source={require("@/assets/images/icon.png")} />
    );
  }

  return <Image {...imageProps} source={{ uri: imageSource }} />;
};

export default AuthenticatedImage;
