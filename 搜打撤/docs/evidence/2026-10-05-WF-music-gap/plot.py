import pathlib,json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.font_manager import FontProperties
from scipy.ndimage import gaussian_filter1d
OUT=pathlib.Path(__file__).resolve().parent
font=FontProperties(fname='C:/Windows/Fonts/msyh.ttc')
plt.rcParams.update({'font.family':font.get_name(),'axes.unicode_minus':False,'font.size':10,'axes.spines.top':False,'axes.spines.right':False})
data=json.loads((OUT/'comparison.json').read_text(encoding='utf-8'))
tracks=data['tracks'];colors=['#267c9d']*3+['#be713c']*3
labels=[t['name'].split(' · ')[0] for t in tracks]
fig,axes=plt.subplots(2,2,figsize=(13,8.4),constrained_layout=True)
ax=axes[0,0]
for group,color,name in [('demo','#267c9d','我的 B 版（3首）'),('reference','#be713c','明日方舟参考（3首）')]:
    subset=[t for t in tracks if t['group']==group]
    curves=np.array([gaussian_filter1d(t['matched_metrics']['plot']['normalized_power_db'],2) for t in subset]);f=np.array(subset[0]['matched_metrics']['plot']['frequency_hz'])
    ax.plot(f,np.median(curves,axis=0),color=color,lw=2,label=name)
    ax.fill_between(f,curves.min(axis=0),curves.max(axis=0),color=color,alpha=.13)
ax.set_xscale('log');ax.set_xlim(30,10000);ax.set_ylim(-100,-12)
ax.set_title('频率分布：总能量归一化后比较');ax.set_xlabel('频率 Hz');ax.set_ylabel('归一化频点功率 dB');ax.legend(frameon=False,loc='lower left');ax.grid(alpha=.17)
ax.text(.98,.04,'阴影是3首的最小–最大范围，非置信区间',transform=ax.transAxes,ha='right',fontsize=8,color='#666666')
ax=axes[0,1]
width=[100/(1+10**(-t['matched_metrics']['side_mid_energy_db']/10)) for t in tracks]
bars=ax.bar(np.arange(6),width,color=colors,width=.6)
ax.set_xticks(np.arange(6));ax.set_xticklabels(labels,rotation=20,ha='right');ax.set_ylim(0,52)
ax.set_title('空间：侧向声能占比');ax.set_ylabel('S / (M + S) %')
for b,v in zip(bars,width):ax.text(b.get_x()+b.get_width()/2,v+.9,f'{v:.1f}%',ha='center',fontsize=9)
ax.grid(axis='y',alpha=.17);ax.set_axisbelow(True)
ax=axes[1,0]
values=[t['matched_metrics']['onset_autocorrelation_peak'] for t in tracks]
bars=ax.bar(np.arange(6),values,color=colors,width=.6)
ax.set_xticks(np.arange(6));ax.set_xticklabels(labels,rotation=20,ha='right');ax.set_ylim(0,.78)
ax.set_title('节奏：起音包络的周期性脉冲');ax.set_ylabel('归一化自相关峰（0.25–1.5秒）')
for b,v in zip(bars,values):ax.text(b.get_x()+b.get_width()/2,v+.014,f'{v:.2f}',ha='center',fontsize=9)
ax.grid(axis='y',alpha=.17);ax.set_axisbelow(True)
ax=axes[1,1]
values=[t['matched_metrics']['spectral_shape_novelty_median'] for t in tracks]
bars=ax.bar(np.arange(6),values,color=colors,width=.6)
ax.set_xticks(np.arange(6));ax.set_xticklabels(labels,rotation=20,ha='right');ax.set_ylim(0,.3)
ax.set_title('织体：去除增益差后的频谱形状移动');ax.set_ylabel('前后6秒形状距离中位数（无单位）')
for b,v in zip(bars,values):ax.text(b.get_x()+b.get_width()/2,v+.007,f'{v:.3f}',ha='center',fontsize=9)
ax.grid(axis='y',alpha=.17);ax.set_axisbelow(True)
fig.suptitle('当前三首 B 版 vs 三首明日方舟官方参考 · 同取12–60秒',fontsize=15)
fig.savefig(OUT/'comparison.png',dpi=150,facecolor='white');plt.close(fig)

fig,axes=plt.subplots(2,3,figsize=(13,6),sharey=True,constrained_layout=True)
for ax,t,color in zip(axes.flat,tracks,colors):
    rms=np.array(t['full_track']['rms_1s_dbfs']);relative=(np.arange(len(rms))+.5)/t['full_track']['seconds']*100
    curve=gaussian_filter1d(rms,1.3)-np.median(rms)
    ax.plot(relative,curve,color=color,lw=1.4);ax.axhline(0,color='#999999',ls=':',lw=.8)
    ax.set_title(t['name'].split(' · ')[0]);ax.set_xlim(0,100);ax.set_ylim(-18,10);ax.grid(alpha=.17)
    ax.set_xlabel('全曲相对进度 %');ax.set_ylabel('相对本曲中位RMS dB')
fig.suptitle('全曲动态轨迹：减去各自中位响度，保留起伏；参考曲更长且可能有片头片尾',fontsize=13)
fig.savefig(OUT/'full-dynamics.png',dpi=150,facecolor='white');plt.close(fig)
summary={}
for group in ['demo','reference']:
    subset=[t for t in tracks if t['group']==group]
    summary[group]={}
    fields={'centroid_hz':lambda t:t['matched_metrics']['spectral_centroid_mean_hz'],'side_share_percent':lambda t:100/(1+10**(-t['matched_metrics']['side_mid_energy_db']/10)),'onsets_per_second':lambda t:t['matched_metrics']['onsets_per_second'],'pulse_regularity':lambda t:t['matched_metrics']['onset_autocorrelation_peak'],'texture_change':lambda t:t['matched_metrics']['spectral_shape_novelty_median'],'full_lra_lu':lambda t:t['full_track']['loudness']['input_lra'],'full_lufs':lambda t:t['full_track']['loudness']['input_i']}
    for key,f in fields.items():
        values=[f(t) for t in subset];summary[group][key]={'min':min(values),'median':float(np.median(values)),'max':max(values)}
(OUT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=True))
