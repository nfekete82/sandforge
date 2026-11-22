#!/usr/bin/env python3
"""One-time vendor of CC0, FULL PBR desert materials from Poly Haven.
Run in GitHub Actions once; commit the three sets to the repository so the
game never depends on a live CDN/API, external network or unknown licenses.
API provider credit: https://polyhaven.com/our-api (CC0 assets).
"""
from __future__ import annotations
import hashlib
import io
import json
import pathlib
import urllib.request
from PIL import Image

ROOT=pathlib.Path('src/assets/reborn/terrain')
SOURCES={
 'sonoran':'red_sand',
 'mojave':'sandy_gravel',
 'badlands':'rock_ground'
}
MAP_KEYS={
 'albedo':['diffuse','diff','albedo','basecolor','base_color','color'],
 'normal':['nor_gl','normal_gl','normal'],
 'rough':['rough','roughness']
}
def download(url):
 req=urllib.request.Request(url,headers={'User-Agent':'SandforgeGameAssets/1.0 (OpenAI user developer; Poly Haven CC0)'})
 with urllib.request.urlopen(req,timeout=40) as resp:return resp.read()
def select_file(tree,names):
 for key,versions in tree.items():
  if key.lower().replace(' ','').replace('-','').replace('_','') not in [
    n.lower().replace('_','') for n in names
  ]:continue
  for resolution in ['1k','2k']:
   options=versions.get(resolution,{})
   for ext in ['jpg','png','webp']:
    if isinstance(options.get(ext),dict) and options[ext].get('url'):
     return options[ext]['url']
 raise RuntimeError('CC0 PBR map missing: '+str(names)+'; available '+str(list(tree)))
def main():
 ROOT.mkdir(parents=True,exist_ok=True)
 manifest={}
 for region,slug in SOURCES.items():
  tree=json.loads(download('https://api.polyhaven.com/files/'+slug))
  assets={}
  for suffix,names in MAP_KEYS.items():
   url=select_file(tree,names)
   original=download(url)
   with Image.open(io.BytesIO(original)) as img:
    if suffix=='rough':
     img=img.convert('L')
    else:img=img.convert('RGB')
    img.thumbnail((1024,1024),Image.Resampling.LANCZOS)
    path=ROOT/('desert-'+region+'-'+suffix+'.webp')
    img.save(path,'WEBP',quality=90 if suffix=='normal' else 86,method=6)
    assets[suffix]={
     'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
     'size':path.stat().st_size,
     'source':f'https://polyhaven.com/a/{slug}',
     'license':'CC0'
    }
    print(region,suffix, path.stat().st_size,flush=True)
  manifest[region]=assets
 (ROOT/'desert-ecoregions-cc0-manifest.json').write_text(
  json.dumps(manifest,indent=2)+'\n')
if __name__=='__main__':main()
