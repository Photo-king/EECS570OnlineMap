"""Derive transparent building SVGs and independent reference panels. Originals stay intact."""
import copy
import json
import xml.etree.ElementTree as E
from pathlib import Path
S='http://www.w3.org/2000/svg'; E.register_namespace('',S)
def tag(n): return '{'+S+'}'+n
first=[(1287,204),(1329,204),(1329,220),(1365,220),(1365,235),(1399,235),(1399,298),(1574,298),(1574,499),(1518,499),(1518,633),(1574,633),(1574,833),(1610,833),(1610,802),(1726,802),(1726,962),(1704,962),(1704,1239),(1619,1239),(1619,1269),(1548,1269),(1548,1021),(1592,1021),(1592,962),(1473,962),(1473,1310),(1441,1310),(1441,1299),(1225,1299),(1225,900),(1072,900),(1072,1239),(1103,1239),(1103,1268),(1038,1268),(1038,1329),(999,1329),(999,1217),(941,1217),(941,1295),(689,1295),(690,1062),(611,1062),(611,949),(689,949),(689,709),(1044,709),(1044,635),(1101,635),(1101,502),(1044,502),(1044,298),(1218,298),(1218,235),(1254,235),(1254,220),(1287,220)]
# Ground outline follows the restored source wall vertices; used for fit/status only.
# Rendering uses a rectangular artwork crop below, never this approximate footprint.
ground=[(1338.838,258.177),(1521.043,258.177),(1521.043,318.87),(1701.043,318.87),(1701.043,526.261),(1618.262,526.261),(1618.262,654.608),(1701.043,654.608),(1701.043,859.652),(1737.044,859.652),(1737.044,831.454),(1828.609,831.454),(1828.609,986.687),(1692.43,986.687),(1692.43,886.489),(1521.067,886.489),(1521.043,930.084),(1579.863,930.084),(1579.863,949.692),(1597.092,949.692),(1597.092,1233.32),(1278.211,1233.32),(1278.211,1200.692),(1346.745,1200.692),(1346.745,887.578),(1192.144,887.578),(1192.144,1293.423),(1153.749,1293.423),(1153.749,1354.691),(1119.241,1354.691),(1119.241,1322.772),(1089.826,1322.772),(1089.826,1241.975),(927.826,1241.975),(927.826,1322.772),(808.62,1322.772),(808.62,741.239),(860.489,741.239),(860.489,832.193),(940.113,832.193),(940.113,682.057),(1054.618,682.057),(1080.566,682.057),(1080.566,659.592),(1124.851,659.592),(1124.851,700.296),(1158.521,700.296),(1158.521,654.608),(1241.926,654.608),(1241.926,531.115),(1158.521,531.115),(1158.521,318.869),(1338.838,318.869)]
second=[(1788,341),(1984,341),(1984,429),(2261,429),(2261,701),(2185,701),(2185,875),(2261,875),(2261,1147),(2317,1147),(2317,1105),(2438,1105),(2438,1685),(2331,1685),(2331,1803),(2285,1803),(2285,1779),(2224,1779),(2224,1859),(1589,1859),(1589,1800),(1489,1800),(1489,1710),(1505,1710),(1505,1663),(1242,1663),(1242,1762),(1082,1762),(1082,1458),(1056,1458),(1056,1291),(1079,1291),(1079,990),(1548,990),(1548,877),(1622,877),(1622,703),(1553,703),(1553,432),(1788,432)]
footprints={}
for name,outline,factor in [('Ground',ground,1),('First',first,1),('Second',second,.75)]:
 source=E.parse(f'Mapsv1.0/Dental_Kellogg_{name}.svg').getroot()
 points=[(x*factor-39,y*factor+80) for x,y in outline]
 footprints[name.lower()]=[{'x':x,'y':y} for x,y in points]
 root=E.Element(tag('svg'),{'viewBox':'0 0 2280 1650','width':'2280','height':'1650','fill':'none'})
 defs=copy.deepcopy(source.find(tag('defs'))); root.append(defs)
 clip=E.SubElement(defs,tag('clipPath'),{'id':'building-outline','clipPathUnits':'userSpaceOnUse'})
 if name=='Ground':
  # The artwork is isolated between the notes and key. A rectangle preserves
  # every original exterior/courtyard wall and avoids inventing boundary lines.
  E.SubElement(clip,tag('rect'),{'x':'745','y':'320','width':'1065','height':'1135'})
 else:
  E.SubElement(clip,tag('polygon'),{'points':' '.join(f'{x},{y}' for x,y in points)})
 g=E.SubElement(root,tag('g'),{'clip-path':'url(#building-outline)'})
 # Original page backgrounds are clipped to the physical footprint, keeping white corridors.
 content=copy.deepcopy(source.find('.//*[@id="visitor-map-content"]'))
 if name=='Ground':
  # Keep indoor corridors white, while letting the shared green canvas show
  # around the building. This fill does not clip or redraw source wall lines.
  E.SubElement(g,tag('polygon'),{'points':' '.join(f'{x},{y}' for x,y in points),'fill':'white'})
  for parent in content.iter():
   for child in list(parent):
    if child.tag==tag('path') and child.get('d')=='M3456 0H0V2304H3456V0Z' and child.get('fill')=='white':
     parent.remove(child)
 # Remove only large rounded label chips, preserving glyph paths, room fills and symbols.
 label_colors={'#B6E4D0','#B9D9F6','#FFE7A3','#E8F2F7'}
 for parent in content.iter():
  children=list(parent)
  for index,child in enumerate(children):
   if (child.tag==tag('rect') and child.get('fill') in label_colors
       and float(child.get('rx','0'))>=6 and 50<float(child.get('width','0'))<300):
    parent.remove(child)
    # First/Second chips duplicate existing lettering; Ground chips contain
    # the sole room names, so preserve their glyphs after removing the box.
    if name!='Ground' and index+1<len(children) and children[index+1].tag==tag('path'):
     parent.remove(children[index+1])
 g.append(content)
 if name!='Ground':
  E.SubElement(root,tag('polygon'),{'points':' '.join(f'{x},{y}' for x,y in points),'fill':'none','stroke':'#426858','stroke-width':'2'})
 E.ElementTree(root).write(f'public/maps/{name.lower()}-building.svg',encoding='unicode')
 for part,box in [('notes','75 375 445 610'),('key','1800 450 420 850')]:
  if part=='key' and name=='First':box='1705 470 510 850'
  panel=copy.deepcopy(source);panel.set('viewBox',box);panel.attrib.pop('width',None);panel.attrib.pop('height',None)
  for child in list(panel):
   if child.get('id') in ['sign-finish-background','sign-finish-type']:panel.remove(child)
  E.ElementTree(panel).write(f'public/maps/{name.lower()}-{part}.svg',encoding='unicode')
# One shared symbol/color key prevents broken symbols in the other source variants.
shared_key=Path('public/maps/first-key.svg').read_text()
for name in ['ground','second']:Path(f'public/maps/{name}-key.svg').write_text(shared_key)
print('Prepared clean floor labels, floor-specific notes and one shared First-floor key.')

Path('map-footprints.js').write_text('export const footprints = '+json.dumps(footprints)+';\n')
