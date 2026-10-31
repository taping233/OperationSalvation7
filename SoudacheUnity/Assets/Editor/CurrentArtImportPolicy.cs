using UnityEditor;

namespace Sdt.EditorTools
{
    /// <summary>Keep current source art proportions on future imports as well as the repaired imports.</summary>
    public sealed class CurrentArtImportPolicy : AssetPostprocessor
    {
        void OnPreprocessTexture()
        {
            if (assetPath.StartsWith("Assets/Resources/Art/Current", System.StringComparison.Ordinal)
                && assetPath.EndsWith(".png", System.StringComparison.OrdinalIgnoreCase))
            {
                var texture=(TextureImporter)assetImporter;
                texture.npotScale=TextureImporterNPOTScale.None;
                texture.textureCompression=TextureImporterCompression.Uncompressed;
                texture.mipmapEnabled=false;
                texture.GetSourceTextureWidthAndHeight(out int width,out int height);
                texture.maxTextureSize=UnityEngine.Mathf.Max(texture.maxTextureSize,UnityEngine.Mathf.NextPowerOfTwo(UnityEngine.Mathf.Max(width,height)));
            }
        }
    }
}
