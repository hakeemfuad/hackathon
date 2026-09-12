"""Offline geometry inspection; this is not a browser or a website screenshot."""
from pathlib import Path
import json, math
import numpy as np
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parent.parent
data=json.loads((root/'.sites-runtime/model-check.json').read_text())
W,H=420,760
canvas=Image.new('RGB',(W*3,H),'#eff0f2')
for j,index in enumerate([1,3,5]):
    model=data['meshes'][index]
    xyz=np.array(model['positions']).reshape(-1,3)
    normals=np.array(model['normals']).reshape(-1,3)
    faces=np.array(model['indices']).reshape(-1,3)
    angle=.22
    rotation=np.array([[math.cos(angle),0,math.sin(angle)],[0,1,0],[-math.sin(angle),0,math.cos(angle)]])
    xyz=xyz@rotation.T;normals=normals@rotation.T
    scale=610/xyz[:,1].max()
    projected=np.column_stack((xyz[:,0]*scale+W/2+j*W, H-65-xyz[:,1]*scale))
    light=np.array([-.5,.65,1]);light/=np.linalg.norm(light)
    order=np.argsort(xyz[faces,2].mean(axis=1))
    draw=ImageDraw.Draw(canvas)
    for k in order:
        face=faces[k];n=normals[face].mean(axis=0);n/=max(np.linalg.norm(n),.001)
        diffuse=max(0,float(n@light))
        c=np.clip(np.array([174,167,164])*(.48+.70*diffuse),0,255).astype(int)
        draw.polygon([tuple(p) for p in projected[face]], fill=tuple(c))
    draw.text((j*W+24,24),model['name']+' — mesh check',fill='#444a55')
canvas.save(root/'.sites-runtime/model-check.png')
print(root/'.sites-runtime/model-check.png')
