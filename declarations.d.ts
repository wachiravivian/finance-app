// declarations.d.ts

declare module "react-native-html-to-pdf" {
  const RNHTMLtoPDF: {
    convert(options: {
      html: string;
      fileName?: string;
      base64?: boolean;
    }): Promise<{ filePath: string }>;
  };
  export = RNHTMLtoPDF; // ✅ note: uses CommonJS export style
}
