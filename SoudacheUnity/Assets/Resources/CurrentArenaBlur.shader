Shader "Hidden/SDT Current Arena Gaussian"
{
    Properties { _MainTex ("Premultiplied arena", 2D) = "black" {} }
    SubShader
    {
        Cull Off ZWrite Off ZTest Always Blend Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert_img
            #pragma fragment frag
            #pragma target 2.0
            #include "UnityCG.cginc"
            sampler2D _MainTex; float2 _Step;
            fixed4 sampleArena(float2 uv) { return tex2D(_MainTex, uv) * step(0, uv.x) * step(uv.x, 1) * step(0, uv.y) * step(uv.y, 1); }
            fixed4 frag(v2f_img i):SV_Target
            {
                // Thirteen Gaussian taps at half-sigma intervals, normalized through +/-3 sigma.
                fixed4 color = sampleArena(i.uv) * .1996756;
                color += (sampleArena(i.uv + _Step * .5) + sampleArena(i.uv - _Step * .5)) * .1762131;
                color += (sampleArena(i.uv + _Step) + sampleArena(i.uv - _Step)) * .1211094;
                color += (sampleArena(i.uv + _Step * 1.5) + sampleArena(i.uv - _Step * 1.5)) * .0648252;
                color += (sampleArena(i.uv + _Step * 2) + sampleArena(i.uv - _Step * 2)) * .0270232;
                color += (sampleArena(i.uv + _Step * 2.5) + sampleArena(i.uv - _Step * 2.5)) * .0087731;
                color += (sampleArena(i.uv + _Step * 3) + sampleArena(i.uv - _Step * 3)) * .0022182;
                return color;
            }
            ENDCG
        }
    }
}
