Shader "UI/SDT Current Home Ghost"
{
    Properties
    {
        [PerRendererData] _MainTex("Font atlas",2D)="white"{}
        _StencilComp("Stencil Comparison",Float)=8
        _Stencil("Stencil ID",Float)=0
        _StencilOp("Stencil Operation",Float)=0
        _StencilWriteMask("Stencil Write Mask",Float)=255
        _StencilReadMask("Stencil Read Mask",Float)=255
        _ColorMask("Color Mask",Float)=15
        [Toggle(UNITY_UI_ALPHACLIP)] _UseUIAlphaClip("Use Alpha Clip",Float)=0
    }
    SubShader
    {
        Tags{"Queue"="Transparent" "IgnoreProjector"="True" "RenderType"="Transparent" "CanUseSpriteAtlas"="True"}
        Stencil{Ref[_Stencil] Comp[_StencilComp] Pass[_StencilOp] ReadMask[_StencilReadMask] WriteMask[_StencilWriteMask]}
        Cull Off Lighting Off ZWrite Off ZTest[unity_GUIZTestMode] Blend SrcAlpha OneMinusSrcAlpha ColorMask[_ColorMask]
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 3.0
            #pragma multi_compile_local _ UNITY_UI_CLIP_RECT
            #pragma multi_compile_local _ UNITY_UI_ALPHACLIP
            #include "UnityCG.cginc"
            #include "UnityUI.cginc"
            struct a{float4 vertex:POSITION;float4 color:COLOR;float2 uv:TEXCOORD0;};
            struct v{float4 vertex:SV_POSITION;float4 color:COLOR;float2 uv:TEXCOORD0;float4 screen:TEXCOORD1;float4 world:TEXCOORD2;};
            sampler2D _MainTex;float4 _ClipRect;
            v vert(a i){v o;o.world=i.vertex;o.vertex=UnityObjectToClipPos(i.vertex);o.screen=ComputeScreenPos(o.vertex);o.color=i.color;o.uv=i.uv;return o;}
            fixed4 frag(v i):SV_Target
            {
                // Dilation minus erosion, centred on the font alpha edge. The face is never drawn.
                // Half a logical pixel on each side = CSS text-stroke:1px at the 1920 reference width.
                float2 dx=ddx(i.uv)*(.5*_ScreenParams.x/1920.);
                float2 dy=ddy(i.uv)*(.5*_ScreenParams.x/1920.);
                float low=1,high=0;
                [unroll]for(int y=-1;y<=1;y++)[unroll]for(int x=-1;x<=1;x++)
                {float alpha=tex2D(_MainTex,i.uv+x*dx+y*dy).a;low=min(low,alpha);high=max(high,alpha);}
                float sx=i.screen.x/i.screen.w;
                float mask=(1-saturate((sx-.30)/.12))+saturate((sx-.64)/.12);
                float alpha=saturate(high-low)*i.color.a*saturate(mask);
                #ifdef UNITY_UI_CLIP_RECT
                alpha*=UnityGet2DClipping(i.world.xy,_ClipRect);
                #endif
                #ifdef UNITY_UI_ALPHACLIP
                clip(alpha-.001);
                #endif
                return fixed4(i.color.rgb,alpha);
            }
            ENDCG
        }
    }
}
