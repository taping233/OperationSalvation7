from pathlib import Path
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubCurrentInteractions.cs');s=p.read_text(encoding='utf-8-sig')
s=s.replace('float t=1.4f-remaining,curve=Mathf.Sin(Mathf.Clamp01(t/.65f)*Mathf.PI);\n                if(_reaction==0)Art.localEulerAngles=new Vector3(0,0,curve*9);else if(_reaction==1)Art.anchoredPosition=_origin+new Vector2(0,Mathf.Abs(Mathf.Sin(t*10))*12*Mathf.Clamp01(remaining));else Art.localScale=Vector3.one*(1+curve*.045f);','''float t=1.4f-remaining;Art.anchoredPosition=_origin;Art.localEulerAngles=Vector3.zero;Art.localScale=Vector3.one;
                if(Sdt.Run.GameRuntime.I.Saves.Global.GetString("sdt-reduce-motion")=="1")return;
                if(_reaction==0)Art.localEulerAngles=new Vector3(0,0,Frame(t/.62f,new[]{0f,.4f,.7f,1f},new[]{0f,7f,-3f,0f}));
                else if(_reaction==1){float v=t/.56f;Art.anchoredPosition=_origin+new Vector2(0,Frame(v,new[]{0f,.3f,.58f,.8f,1f},new[]{0f,-3f,10f,-1f,0f}));Art.localScale=new Vector3(Frame(v,new[]{0f,.3f,1f},new[]{1f,1.02f,1f}),Frame(v,new[]{0f,.3f,1f},new[]{1f,.98f,1f}),1);}
                else{float v=t/.62f,shift=Frame(v,new[]{0f,.5f,1f},new[]{0f,1f,0f});Art.anchoredPosition=_origin+new Vector2(5*shift,0);Art.localEulerAngles=new Vector3(0,0,-3*shift);Art.localScale=Vector3.one*(1+.035f*shift);}''')
s=s.replace('            void Reset(){','''            static float Frame(float time,float[] times,float[] values)
            {
                if(time>=1)return values[values.Length-1];int index=1;while(index<times.Length-1&&time>times[index])index++;
                float t=Mathf.Clamp01((time-times[index-1])/(times[index]-times[index-1])),lo=0,hi=1,v=t;
                for(int n=0;n<9;n++){v=(lo+hi)*.5f;float u=1-v,x=3*u*u*v*.42f+3*u*v*v*.58f+v*v*v;if(x<t)lo=v;else hi=v;}float curve=3*(1-v)*v*v+v*v*v;return Mathf.Lerp(values[index-1],values[index],curve);
            }
            void Reset(){''')
p.write_text(s,encoding='utf-8')
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubScreen.cs');s=p.read_text(encoding='utf-8-sig').replace('BrowseScroll.Clear();BrowseFocus.Clear();_collectionPage=0;_storySegment=0;','BrowseScroll.Clear();BrowseFocus.Clear();_collectionPage=_poolPage=0;_storySegment=0;_rewardRecord=_milestoneRecord=_achievementQuery="";')
p.write_text(s,encoding='utf-8')
