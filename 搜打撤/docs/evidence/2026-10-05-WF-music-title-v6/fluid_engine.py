"""Offline piano rendering through the DAW's existing FluidSynth library."""
import pathlib,ctypes,os
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[3]
APP=ROOT/'.tmp/music-workstation/LMMS'
DLL_DIR=os.add_dll_directory(str(APP))
LIB=ctypes.CDLL(str(APP/'libfluidsynth.dll'))
PTR=ctypes.c_void_p;INT=ctypes.c_int;CHAR=ctypes.c_char_p;DOUBLE=ctypes.c_double
def bind(name,restype,args):
    f=getattr(LIB,name);f.restype=restype;f.argtypes=args;return f
new_settings=bind('new_fluid_settings',PTR,[])
new_synth=bind('new_fluid_synth',PTR,[PTR])
delete_synth=bind('delete_fluid_synth',None,[PTR]);delete_settings=bind('delete_fluid_settings',None,[PTR])
setnum=bind('fluid_settings_setnum',INT,[PTR,CHAR,DOUBLE]);setint=bind('fluid_settings_setint',INT,[PTR,CHAR,INT])
sfload=bind('fluid_synth_sfload',INT,[PTR,CHAR,INT])
program=bind('fluid_synth_program_select',INT,[PTR,INT,INT,INT,INT])
noteon=bind('fluid_synth_noteon',INT,[PTR,INT,INT,INT]);noteoff=bind('fluid_synth_noteoff',INT,[PTR,INT,INT])
cc=bind('fluid_synth_cc',INT,[PTR,INT,INT,INT])
write=bind('fluid_synth_write_float',INT,[PTR,INT,PTR,INT,INT,PTR,INT,INT])
version=bind('fluid_version_str',CHAR,[])

def render(events,seconds,sr=48000,bank=0,patch=0):
    settings=new_settings();setnum(settings,b'synth.sample-rate',sr);setnum(settings,b'synth.gain',.5)
    setint(settings,b'synth.reverb.active',0);setint(settings,b'synth.chorus.active',0)
    synth=new_synth(settings)
    old_cwd=os.getcwd()
    try:
        os.chdir(APP)
        font=sfload(synth,b'../GeneralUser-GS.sf2',1)
        if font<0:raise RuntimeError('Existing SoundFont could not be loaded')
        assert program(synth,0,font,bank,patch)==0
        frames=round(seconds*sr);audio=np.zeros((frames,2),dtype=np.float32)
        cursor=0
        for frame,priority,kind,key,value in sorted(events):
            frame=int(np.clip(frame,0,frames))
            if frame>cursor:
                ptr=audio[cursor:].ctypes.data_as(PTR);assert write(synth,frame-cursor,ptr,0,2,ptr,1,2)==0;cursor=frame
            if kind=='on':noteon(synth,0,key,value)
            elif kind=='off':noteoff(synth,0,key)
            elif kind=='cc':cc(synth,0,key,value)
        if cursor<frames:
            ptr=audio[cursor:].ctypes.data_as(PTR);assert write(synth,frames-cursor,ptr,0,2,ptr,1,2)==0
        return audio
    finally:
        os.chdir(old_cwd);delete_synth(synth);delete_settings(settings)
