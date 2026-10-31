Shader "UI/SDT Current Home Composite"
{
    Properties
    {
        [PerRendererData] _MainTex("Source",2D)="white"{}
        _Mode("0 screen,1 soft-light,2 backdrop,3 normal,4 flash",Float)=0
        _Blur("CSS blur px",Float)=0
        _Saturation("CSS saturate",Float)=1
        _MaskMode("0 none,1 depth,2 grain,3 near snow",Float)=0
        _Panel("0 no fill,1 credits,2 backdrop tint",Float)=0
        _Tint("Backdrop fill",Color)=(0,0,0,0)
        _Ensemble("Ensemble wallpaper",Float)=0
        _Flash("0 none,1 warm,2 dark",Float)=0
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
        // Unnamed capture is deliberate: each CSS backdrop sees all earlier composition layers.
        GrabPass{}
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
            struct v{float4 vertex:SV_POSITION;float4 color:COLOR;float2 uv:TEXCOORD0;float4 screen:TEXCOORD1;float4 world:TEXCOORD2;float4 grab:TEXCOORD3;};
            sampler2D _MainTex,_GrabTexture;
            float4 _ClipRect,_Tint;float _Mode,_Blur,_Saturation,_MaskMode,_Panel,_Ensemble,_Flash;
            v vert(a i){v o;o.world=i.vertex;o.vertex=UnityObjectToClipPos(i.vertex);o.screen=ComputeScreenPos(o.vertex);o.grab=ComputeGrabScreenPos(o.vertex);o.color=i.color;o.uv=i.uv;return o;}
            float radial(float2 uv,float2 centre,float2 radius){return length((uv-centre)/radius);}
            float softMask(float2 uv)
            {
                if(_MaskMode<.5)return 1;
                if(_MaskMode<1.5)
                {
                    float ellipse=_Ensemble>.5?saturate((radial(uv,float2(.51,.49),float2(.46,.62))-.68)/.29):saturate((radial(uv,float2(.55,.48),float2(.30,.56))-.66)/.28);
                    return _Ensemble>.5?ellipse:ellipse*(1-saturate((uv.y-.60)/.37));
                }
                if(_MaskMode<2.5)return saturate((radial(uv,float2(.55,.38),float2(.23,.42))-.56)/.36);
                return saturate((radial(uv,float2(.55,.30),float2(.15,.24))-.55)/.40);
            }
            float3 softLight(float3 backdrop,float3 source)
            {
                float3 d=lerp(((16*backdrop-12)*backdrop+4)*backdrop,sqrt(max(0,backdrop)),step(.25,backdrop));
                return lerp(backdrop-(1-2*source)*backdrop*(1-backdrop),backdrop+(2*source-1)*(d-backdrop),step(.5,source));
            }
            fixed4 frag(v i):SV_Target
            {
                float2 screen=i.screen.xy/i.screen.w,top=float2(screen.x,1-screen.y),grab=i.grab.xy/i.grab.w;
                fixed4 source=tex2D(_MainTex,i.uv);float alpha=source.a*i.color.a*softMask(top);float3 result=source.rgb*i.color.rgb;
                if(_Mode<.5)result=1-(1-tex2D(_GrabTexture,grab).rgb)*(1-result);
                else if(_Mode<1.5)result=softLight(tex2D(_GrabTexture,grab).rgb,result);
                else if(_Mode<2.5)
                {
                    float2 stepSize=float2(_Blur/1920.,_Blur/1080.);float total=0;float3 blurred=0;
                    if(_Blur>=14)
                    {
                        // Importance-sample a Gaussian truncated at 3 sigma. A coarse
                        // regularly spaced kernel leaves visible copies of text at large blur.
                        [unroll]for(int tap=0;tap<96;tap++)
                        {
                            float radius=sqrt(-2*log(1-((tap+.5)/96.)*(1-exp(-4.5))));
                            float angle=tap*2.39996323;
                            blurred+=tex2D(_GrabTexture,grab+float2(cos(angle),sin(angle))*radius*stepSize).rgb;
                        }
                        total=96;
                    }
                    else
                    {
                        [unroll]for(int y=-3;y<=3;y++)[unroll]for(int x=-3;x<=3;x++)
                        {float weight=exp(-.5*(x*x+y*y));blurred+=tex2D(_GrabTexture,grab+float2(x,y)*stepSize).rgb*weight;total+=weight;}
                    }
                    result=blurred/total;float luminance=dot(result,float3(.2126,.7152,.0722));result=lerp(luminance.xxx,result,_Saturation);
                    if(_Panel>.5&&_Panel<1.5)
                    {
                        // title-credits.css radial over a 145deg two-stop translucent gradient.
                        float t=saturate((i.uv.x+(1-i.uv.y)*1.428)/2.428);
                        float4 fill=lerp(float4(.1451,.1804,.2196,.6196),float4(.06275,.10196,.1451,.5882),t);
                        float highlight=saturate(1-radial(float2(i.uv.x,1-i.uv.y),float2(.18,0),float2(.82,1))/.55)*.1098;
                        fill.rgb=lerp(fill.rgb,float3(.8627,.8902,.9137),highlight);fill.a=fill.a+highlight*(1-fill.a);
                        result=lerp(result,fill.rgb,fill.a);
                    }
                    else if(_Panel>1.5)result=lerp(result,_Tint.rgb,_Tint.a);
                }
                else if(_Mode>3.5)
                {
                    if(_Flash<.5)alpha=0;
                    else if(_Flash<1.5)
                    {
                        float r=radial(top,float2(.52,.42),float2(.60,.70));
                        float4 flash=r<.55?lerp(float4(1,.9137,.6588,.851),float4(.8784,.7059,.3529,.2),r/.55):lerp(float4(.8784,.7059,.3529,.2),float4(.8784,.7059,.3529,0),saturate((r-.55)/.25));
                        result=flash.rgb;alpha*=flash.a;
                    }
                    else result=float3(.0196,.0235,.0392);
                }
                #ifdef UNITY_UI_CLIP_RECT
                alpha*=UnityGet2DClipping(i.world.xy,_ClipRect);
                #endif
                #ifdef UNITY_UI_ALPHACLIP
                clip(alpha-.001);
                #endif
                return fixed4(result,alpha);
            }
            ENDCG
        }
    }
}
