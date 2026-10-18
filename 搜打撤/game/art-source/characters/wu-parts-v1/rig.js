export const REST={
 waist:[650,390],neck:[687,232],
 shoulderR:[597,250],elbowR:[636,404],wristR:[766,503],
 shoulderL:[714,250],elbowL:[748,368],wristL:[807,373],
 hipR:[716,490],kneeR:[800,700],ankleR:[852,874],
 hipL:[640,485],kneeL:[574,680],ankleL:[478,866]
};
export const boxes={
 '01':[511,197,257,199], '08':[477,368,343,242], '09':[463,373,382,244],
 '02':[629,55,143,175], '04':[602,26,176,205], '03':[610,31,176,203],
 '07':[638,50,137,49], '06':[582,24,103,168], '05':[311,21,324,595],
 '18':[810,839,138,160], '21':[410,837,102,162]
};
export const anchors={
 '01':[[.51205,.03795],[.56024,.90759]],
 '16':[[.32,.03],[.79,.93]], '17':[[.68,.03],[.27,.95]],
 '19':[[.65,.03],[.19,.94]], '20':[[.67,.03],[.19,.95]],
 '10':[[.34,.06],[.80,.94]], '11':[[.19,.07],[.77,.89]],
 '13':[[.45,.06],[.78,.92]], '14':[[.21,.07],[.78,.89]]
};
const blend=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const smooth=t=>t*t*(3-2*t);
const rotate=(p,c,a)=>[c[0]+(p[0]-c[0])*Math.cos(a)-(p[1]-c[1])*Math.sin(a),c[1]+(p[0]-c[0])*Math.sin(a)+(p[1]-c[1])*Math.cos(a)];
const length=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
export const BONE_LENGTHS={
 upperR:length(REST.shoulderR,REST.elbowR),lowerR:length(REST.elbowR,REST.wristR),
 upperL:length(REST.shoulderL,REST.elbowL),lowerL:length(REST.elbowL,REST.wristL),
 thighR:length(REST.hipR,REST.kneeR),calfR:length(REST.kneeR,REST.ankleR),
 thighL:length(REST.hipL,REST.kneeL),calfL:length(REST.kneeL,REST.ankleL)
};
function ik(a,b,l1,l2,side=1){
 const dx=b[0]-a[0],dy=b[1]-a[1],raw=Math.hypot(dx,dy),d=Math.max(Math.abs(l1-l2)+.01,Math.min(raw,l1+l2-.01));
 const u=[dx/raw,dy/raw],x=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-x*x));
 return [a[0]+u[0]*x-u[1]*h*side,a[1]+u[1]*x+u[0]*h*side];
}
export function pose(mode,phase){
 let dx=0,dy=0,lean=0,swing=-.42,wrist=[...REST.wristR];
 if(mode==='idle'){dy=(1-Math.cos(phase*2*Math.PI))*1.5;lean=Math.sin(phase*2*Math.PI)*.004;}
 if(mode==='attack'){
   if(phase<.35){const t=smooth(phase/.35);wrist=blend(wrist,[754,197],t);swing=-.42+(-2.40+.42)*t;lean=-.025*t;dy=8*t;}
   else if(phase<.60){const t=smooth((phase-.35)/.25);wrist=blend([754,197],[861,478],t);swing=-2.40+3.0*t;dx=25*t;dy=8+12*t;lean=-.025+.10*t;}
   else{const t=smooth((phase-.60)/.40);wrist=blend([861,478],REST.wristR,t);swing=.60-1.02*t;dx=25*(1-t);dy=20*(1-t);lean=.075*(1-t);}
 }
 if(mode==='hit'){const t=Math.sin(Math.PI*phase)**2;dx=-26*t;dy=15*t;lean=-.07*t;wrist=[REST.wristR[0]-26*t,REST.wristR[1]];}
 const body=p=>{const r=rotate(p,REST.waist,lean);return [r[0]+dx,r[1]+dy];};
 const shoulderR=body(REST.shoulderR),shoulderL=body(REST.shoulderL);
 if(mode==='idle'||mode==='static') wrist=body(wrist);
 const elbowR=ik(shoulderR,wrist,BONE_LENGTHS.upperR,BONE_LENGTHS.lowerR,1);
 const wristL=body(REST.wristL),elbowL=ik(shoulderL,wristL,BONE_LENGTHS.upperL,BONE_LENGTHS.lowerL,1);
 const handAngle=swing+.28,gripOffset=rotate([39.9,11.44],[0,0],handAngle),grip=[wrist[0]+gripOffset[0],wrist[1]+gripOffset[1]];
 const hipR=body(REST.hipR),hipL=body(REST.hipL),ankleR=[...REST.ankleR],ankleL=[...REST.ankleL];
 const kneeR=ik(hipR,ankleR,BONE_LENGTHS.thighR,BONE_LENGTHS.calfR,-1);
 const kneeL=ik(hipL,ankleL,BONE_LENGTHS.thighL,BONE_LENGTHS.calfL,-1);
 return {dx,dy,lean,swing,wrist,elbowR,shoulderR,wristL,elbowL,shoulderL,body,handAngle,grip,hipR,kneeR,ankleR,hipL,kneeL,ankleL,
  ponySway:Math.sin(phase*2*Math.PI-.5)*.012+(mode==='attack'?Math.sin(phase*Math.PI)*.035:0)};
}
