"""Render exportable charts solely from the independent comparison.json."""
import pathlib,json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.font_manager import FontProperties
OUT=pathlib.Path(__file__).resolve().parent
font=FontProperties(fname='C:/Windows/Fonts/msyh.ttc')
plt.rcParams.update({'font.family':font.get_name(),'axes.unicode_minus':False,'font.size':10,'figure.facecolor':'#f6f5f1','axes.facecolor':'#f6f5f1','axes.spines.top':False,'axes.spines.right':False})
d=json.loads((OUT/'comparison.json').read_text(encoding='utf-8'));rr=d['records'];names=[r['name'] for r in rr]
cols=['#1b6980','#b1723c','#6b7650','#86618b'];main=[r['segments']['legacy_12_60']['metrics'] for r in rr]
fig,ax=plt.subplots(2,2,figsize=(13,8.6),layout='constrained');fig.suptitle('V7 与三首官方参考：同口径差异，不是音乐质量评分',fontsize=17)
bands=np.array([m['bands_percent'] for m in main]);left=np.zeros(4)
labels=['<80','80–250','250–500','500–2000','2k–5k','5k–10k','10k–12k'];palette=['#183e55','#3d7990','#79b8be','#ccb678','#c48155','#ac5f6f','#714b70']
for i,(label,c) in enumerate(zip(labels,palette)):
    ax[0,0].barh(names,bands[:,i],left=left,color=c,label=label+' Hz');left+=bands[:,i]
ax[0,0].set(xlim=(0,100),xlabel='两声道功率频谱占比 %',title='12–60 秒频段分布（去除整体音量差）');ax[0,0].invert_yaxis()
ax[0,0].legend(ncol=4,fontsize=7.5,loc='lower center',bbox_to_anchor=(.5,-.36))
for i,r in enumerate(rr):
    values=[v['metrics']['side_percent'] for v in r['segments'].values()]
    ax[0,1].plot([min(values),max(values)],[i,i],color=cols[i],lw=6,alpha=.35)
    ax[0,1].scatter(main[i]['side_percent'],i,color=cols[i],s=65)
    ax[0,1].text(main[i]['side_percent']+1,i,'%.1f%%'%main[i]['side_percent'],va='center')
ax[0,1].set(yticks=range(4),yticklabels=names,xlabel='S / (M + S) 能量 %',title='声像宽度：点=12–60 秒，线=七窗口范围',xlim=(0,65));ax[0,1].invert_yaxis()
x=np.arange(4);ax[1,0].bar(x-.18,[r['full_loudness']['input_lra'] for r in rr],.36,color=cols,label='全曲 LRA（LU）')
ax[1,0].bar(x+.18,[m['rms_1s_p90_p10_db'] for m in main],.36,color=cols,alpha=.4,label='12–60秒 1秒RMS P90−P10（dB）')
ax[1,0].set(xticks=x,xticklabels=names,ylabel='不同定义，勿直接互换',title='动态：长曲长度与片段选择会影响结果');ax[1,0].legend(fontsize=8)
for i,r in enumerate(rr):
    vals=[v['metrics']['onset_stereo_power']['periodicity_peak'] for v in r['segments'].values()]
    ax[1,1].plot([min(vals),max(vals)],[i,i],color=cols[i],lw=6,alpha=.35)
    ax[1,1].scatter(main[i]['onset_stereo_power']['periodicity_peak'],i,color=cols[i],s=65)
    ax[1,1].text(main[i]['onset_stereo_power']['periodicity_peak']+.015,i,'%.2f'%main[i]['onset_stereo_power']['periodicity_peak'],va='center')
ax[1,1].set(yticks=range(4),yticklabels=names,xlim=(0,.9),xlabel='0.25–1.5秒延迟内最大归一化自相关',title='周期性：点=12–60 秒，线=七窗口范围');ax[1,1].invert_yaxis()
fig.savefig(OUT/'overview.png',dpi=145);plt.close(fig)

fig,ax=plt.subplots(4,2,figsize=(12,11),layout='constrained');fig.suptitle('全曲发展与重复诊断：V7 是91秒循环，参考是完整曲目',fontsize=16)
for i,r in enumerate(rr):
    st=r['structure'];rms=np.array(st['rms_1s_dbfs']);pct=(np.arange(len(rms))+.5)/r['seconds']*100
    ax[i,0].plot(pct,rms-np.median(rms),color=cols[i],lw=1.4,label='1秒RMS相对中位数')
    if i==0:
        for mark in [25,50,75]:ax[i,0].axvline(mark,color='#555555',alpha=.25,ls='--')
    ax[i,0].set(title=r['name']+' · %.1f秒'%r['seconds'],ylabel='相对强弱 dB',xlim=(0,100),ylim=(-20,10))
    st2=ax[i,0].twinx();st2.plot(np.array(st['novelty_centers_seconds'])/r['seconds']*100,st['novelty_6s'],color='#80786b',lw=1,alpha=.65)
    st2.set(ylim=(0,.7),ylabel='谱形移动');st2.spines['top'].set_visible(False)
    dist=np.array(st['self_distance_4s']);length=dist.shape[0]*4
    im=ax[i,1].imshow(dist,origin='lower',extent=[0,length,0,length],vmin=0,vmax=.7,cmap='magma_r',aspect='auto')
    ax[i,1].set(title='4秒块音色＋音级距离（浅色更相似）',ylabel='秒')
ax[-1,0].set_xlabel('全曲进度 %（不是相同小节或功能位置）');ax[-1,1].set_xlabel('秒（相似不等于旋律重复）')
fig.colorbar(im,ax=ax[:,1],fraction=.025,pad=.02,label='特征距离')
fig.savefig(OUT/'development.png',dpi=130);plt.close(fig)
print('overview.png, development.png')
