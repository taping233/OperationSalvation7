Shader "Sdt/MapAtmosphere"
{
    Properties
    {
        [PerRendererData] _MainTex ("Sprite Texture", 2D) = "white" {}
        _Color ("Tint", Color) = (1,1,1,1)
        _Saturation ("Saturation", Float) = 1
        _Brightness ("Brightness", Float) = 1
        _Contrast ("Contrast", Float) = 1
        _Wash ("Layer Wash", Color) = (0,0,0,0)
        _FadeBottom ("Fade Lower Edge", Float) = 0
    }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" "CanUseSpriteAtlas"="True" }
        Cull Off Lighting Off ZWrite Off
        Blend SrcAlpha OneMinusSrcAlpha
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            struct appdata { float4 vertex:POSITION;float2 uv:TEXCOORD0;fixed4 color:COLOR; };
            struct v2f { float4 vertex:SV_POSITION;float2 uv:TEXCOORD0;fixed4 color:COLOR; };
            sampler2D _MainTex;fixed4 _Color,_Wash;float _Saturation,_Brightness,_Contrast,_FadeBottom;
            v2f vert(appdata v){v2f o;o.vertex=UnityObjectToClipPos(v.vertex);o.uv=v.uv;o.color=v.color*_Color;return o;}
            fixed4 frag(v2f i):SV_Target
            {
                fixed4 c=tex2D(_MainTex,i.uv)*i.color;
                float grey=dot(c.rgb,float3(.2126,.7152,.0722));
                c.rgb=saturate((lerp(grey.xxx,c.rgb,_Saturation)*_Brightness-.5)*_Contrast+.5);
                c.rgb=lerp(c.rgb,_Wash.rgb,_Wash.a);
                c.a*=lerp(1,smoothstep(.10,.52,i.uv.y),_FadeBottom);
                return c;
            }
            ENDCG
        }
    }
}
