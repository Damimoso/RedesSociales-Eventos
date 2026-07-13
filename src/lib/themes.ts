export type ThemeId =
  | 'light' | 'dark' | 'and' | 'ara' | 'ast' | 'bal' | 'can'
  | 'cant' | 'clm' | 'cyl' | 'cat' | 'val' | 'ext'
  | 'gal' | 'rio' | 'mad' | 'mur' | 'nav' | 'pva' | 'ceu' | 'mel'

export type ThemeVars = {
  primary: string
  secondary: string
  'primary-hover': string
  'secondary-hover': string
  base: string
  surface: string
  elevated: string
  text: string
  muted: string
  border: string
}

const hex = (h: string) => h

export const THEMES: Record<ThemeId, { name: string; vars: ThemeVars }> = {
  light: {
    name: 'Claro',
    vars: {
      primary: hex('#7033FF'),
      secondary: hex('#FF4A5A'),
      'primary-hover': hex('#5A29CC'),
      'secondary-hover': hex('#E03545'),
      base: hex('#F8FAFF'),
      surface: hex('#FFFFFF'),
      elevated: hex('#F0F3FF'),
      text: hex('#1A1A2E'),
      muted: hex('#6B7280'),
      border: 'rgba(112,51,255,0.12)',
    },
  },
  dark: {
    name: 'Oscuro',
    vars: {
      primary: hex('#FF4A5A'),
      secondary: hex('#00F2FE'),
      'primary-hover': hex('#E03545'),
      'secondary-hover': hex('#00D0E0'),
      base: hex('#0E131F'),
      surface: hex('#1A2235'),
      elevated: hex('#242D42'),
      text: hex('#F0F4FF'),
      muted: hex('#8892B0'),
      border: 'rgba(0,242,254,0.15)',
    },
  },
  and: {
    name: 'Andalucía',
    vars: {
      primary: hex('#4A8C3F'),
      secondary: hex('#D4A843'),
      'primary-hover': hex('#3D7534'),
      'secondary-hover': hex('#C49A35'),
      base: hex('#F5F0E8'),
      surface: hex('#FFFFFF'),
      elevated: hex('#EDE8DD'),
      text: hex('#2D3436'),
      muted: hex('#7A7A7A'),
      border: 'rgba(74,140,63,0.12)',
    },
  },
  ara: {
    name: 'Aragón',
    vars: {
      primary: hex('#C8102E'),
      secondary: hex('#FFD700'),
      'primary-hover': hex('#A80D25'),
      'secondary-hover': hex('#E6BC00'),
      base: hex('#FFF8E7'),
      surface: hex('#FFFFFF'),
      elevated: hex('#F5EDD3'),
      text: hex('#2D2D2D'),
      muted: hex('#7F7F7F'),
      border: 'rgba(200,16,46,0.12)',
    },
  },
  ast: {
    name: 'Asturias',
    vars: {
      primary: hex('#003366'),
      secondary: hex('#D4A843'),
      'primary-hover': hex('#002244'),
      'secondary-hover': hex('#C49A35'),
      base: hex('#F0F4F8'),
      surface: hex('#FFFFFF'),
      elevated: hex('#E2E8F0'),
      text: hex('#1E293B'),
      muted: hex('#64748B'),
      border: 'rgba(0,51,102,0.12)',
    },
  },
  bal: {
    name: 'Islas Baleares',
    vars: {
      primary: hex('#6B2FA0'),
      secondary: hex('#FFD700'),
      'primary-hover': hex('#5A2888'),
      'secondary-hover': hex('#E6BC00'),
      base: hex('#F8F4FF'),
      surface: hex('#FFFFFF'),
      elevated: hex('#EDE6F5'),
      text: hex('#2D1B3E'),
      muted: hex('#7A6B8A'),
      border: 'rgba(107,47,160,0.12)',
    },
  },
  can: {
    name: 'Canarias',
    vars: {
      primary: hex('#0077B6'),
      secondary: hex('#FFD100'),
      'primary-hover': hex('#005A9E'),
      'secondary-hover': hex('#E6BC00'),
      base: hex('#F0F7FF'),
      surface: hex('#FFFFFF'),
      elevated: hex('#E2EFFA'),
      text: hex('#1E293B'),
      muted: hex('#5A7A96'),
      border: 'rgba(0,119,182,0.12)',
    },
  },
  cant: {
    name: 'Cantabria',
    vars: {
      primary: hex('#CC0000'),
      secondary: hex('#D4A843'),
      'primary-hover': hex('#AA0000'),
      'secondary-hover': hex('#C49A35'),
      base: hex('#FFF5F5'),
      surface: hex('#FFFFFF'),
      elevated: hex('#F5E6E6'),
      text: hex('#2D2D2D'),
      muted: hex('#7A7A7A'),
      border: 'rgba(204,0,0,0.12)',
    },
  },
  clm: {
    name: 'Castilla-La Mancha',
    vars: {
      primary: hex('#6B2FA0'),
      secondary: hex('#D4A843'),
      'primary-hover': hex('#5A2888'),
      'secondary-hover': hex('#C49A35'),
      base: hex('#F8F4FF'),
      surface: hex('#FFFFFF'),
      elevated: hex('#EDE6F5'),
      text: hex('#2D1B3E'),
      muted: hex('#7A6B8A'),
      border: 'rgba(107,47,160,0.12)',
    },
  },
  cyl: {
    name: 'Castilla y León',
    vars: {
      primary: hex('#6B2FA0'),
      secondary: hex('#FFD700'),
      'primary-hover': hex('#5A2888'),
      'secondary-hover': hex('#E6BC00'),
      base: hex('#F8F4FF'),
      surface: hex('#FFFFFF'),
      elevated: hex('#EDE6F5'),
      text: hex('#2D1B3E'),
      muted: hex('#7A6B8A'),
      border: 'rgba(107,47,160,0.12)',
    },
  },
  cat: {
    name: 'Cataluña',
    vars: {
      primary: hex('#C8102E'),
      secondary: hex('#FFD700'),
      'primary-hover': hex('#A80D25'),
      'secondary-hover': hex('#E6BC00'),
      base: hex('#FFF8E7'),
      surface: hex('#FFFFFF'),
      elevated: hex('#F5EDD3'),
      text: hex('#2D2D2D'),
      muted: hex('#7F7F7F'),
      border: 'rgba(200,16,46,0.12)',
    },
  },
  val: {
    name: 'Comunitat Valenciana',
    vars: {
      primary: hex('#003399'),
      secondary: hex('#FFD700'),
      'primary-hover': hex('#002277'),
      'secondary-hover': hex('#E6BC00'),
      base: hex('#F0F4FF'),
      surface: hex('#FFFFFF'),
      elevated: hex('#E2E8F5'),
      text: hex('#1E293B'),
      muted: hex('#5A6B8A'),
      border: 'rgba(0,51,153,0.12)',
    },
  },
  ext: {
    name: 'Extremadura',
    vars: {
      primary: hex('#006600'),
      secondary: hex('#D4A843'),
      'primary-hover': hex('#004D00'),
      'secondary-hover': hex('#C49A35'),
      base: hex('#F0F8F0'),
      surface: hex('#FFFFFF'),
      elevated: hex('#E2EDE2'),
      text: hex('#1E2D1E'),
      muted: hex('#6A7A6A'),
      border: 'rgba(0,102,0,0.12)',
    },
  },
  gal: {
    name: 'Galicia',
    vars: {
      primary: hex('#0055A4'),
      secondary: hex('#8FC7E0'),
      'primary-hover': hex('#004080'),
      'secondary-hover': hex('#7AB5CF'),
      base: hex('#F0F5FA'),
      surface: hex('#FFFFFF'),
      elevated: hex('#E2EAF2'),
      text: hex('#1E293B'),
      muted: hex('#5A7A96'),
      border: 'rgba(0,85,164,0.12)',
    },
  },
  rio: {
    name: 'La Rioja',
    vars: {
      primary: hex('#CC0000'),
      secondary: hex('#4A8C3F'),
      'primary-hover': hex('#AA0000'),
      'secondary-hover': hex('#3D7534'),
      base: hex('#FFF5F5'),
      surface: hex('#FFFFFF'),
      elevated: hex('#F5E6E6'),
      text: hex('#2D2D2D'),
      muted: hex('#7A7A7A'),
      border: 'rgba(204,0,0,0.12)',
    },
  },
  mad: {
    name: 'Comunidad de Madrid',
    vars: {
      primary: hex('#CC0000'),
      secondary: hex('#D4A843'),
      'primary-hover': hex('#AA0000'),
      'secondary-hover': hex('#C49A35'),
      base: hex('#FFF5F5'),
      surface: hex('#FFFFFF'),
      elevated: hex('#F5E6E6'),
      text: hex('#2D2D2D'),
      muted: hex('#7A7A7A'),
      border: 'rgba(204,0,0,0.12)',
    },
  },
  mur: {
    name: 'Región de Murcia',
    vars: {
      primary: hex('#003399'),
      secondary: hex('#FFD700'),
      'primary-hover': hex('#002277'),
      'secondary-hover': hex('#E6BC00'),
      base: hex('#F0F4FF'),
      surface: hex('#FFFFFF'),
      elevated: hex('#E2E8F5'),
      text: hex('#1E293B'),
      muted: hex('#5A6B8A'),
      border: 'rgba(0,51,153,0.12)',
    },
  },
  nav: {
    name: 'Navarra',
    vars: {
      primary: hex('#CC0000'),
      secondary: hex('#D4A843'),
      'primary-hover': hex('#AA0000'),
      'secondary-hover': hex('#C49A35'),
      base: hex('#FFF5F5'),
      surface: hex('#FFFFFF'),
      elevated: hex('#F5E6E6'),
      text: hex('#2D2D2D'),
      muted: hex('#7A7A7A'),
      border: 'rgba(204,0,0,0.12)',
    },
  },
  pva: {
    name: 'País Vasco',
    vars: {
      primary: hex('#4CAF50'),
      secondary: hex('#C8102E'),
      'primary-hover': hex('#3D9140'),
      'secondary-hover': hex('#A80D25'),
      base: hex('#F0F8F0'),
      surface: hex('#FFFFFF'),
      elevated: hex('#E2EDE2'),
      text: hex('#1E2D1E'),
      muted: hex('#6A7A6A'),
      border: 'rgba(76,175,80,0.12)',
    },
  },
  ceu: {
    name: 'Ceuta',
    vars: {
      primary: hex('#2D3436'),
      secondary: hex('#D4A843'),
      'primary-hover': hex('#1A1F21'),
      'secondary-hover': hex('#C49A35'),
      base: hex('#F8F9FA'),
      surface: hex('#FFFFFF'),
      elevated: hex('#F0F0F0'),
      text: hex('#1F2937'),
      muted: hex('#6B7280'),
      border: 'rgba(45,52,54,0.12)',
    },
  },
  mel: {
    name: 'Melilla',
    vars: {
      primary: hex('#003399'),
      secondary: hex('#D4A843'),
      'primary-hover': hex('#002277'),
      'secondary-hover': hex('#C49A35'),
      base: hex('#F0F4FF'),
      surface: hex('#FFFFFF'),
      elevated: hex('#E2E8F5'),
      text: hex('#1E293B'),
      muted: hex('#5A6B8A'),
      border: 'rgba(0,51,153,0.12)',
    },
  },
}

const PROVINCE_TO_COMMUNITY: Record<string, ThemeId> = {
  'alava': 'pva', 'albacete': 'clm', 'alicante': 'val', 'almeria': 'and',
  'asturias': 'ast', 'avila': 'cyl', 'badajoz': 'ext', 'barcelona': 'cat',
  'burgos': 'cyl', 'caceres': 'ext', 'cadiz': 'and', 'cantabria': 'cant',
  'castellon': 'val', 'ceuta': 'ceu', 'ciudad real': 'clm', 'cordoba': 'and',
  'coruña': 'gal', 'cuenca': 'clm', 'girona': 'cat', 'granada': 'and',
  'guadalajara': 'clm', 'gipuzkoa': 'pva', 'huelva': 'and', 'huesca': 'ara',
  'baleares': 'bal', 'jaen': 'and', 'rioja': 'rio', 'las palmas': 'can',
  'leon': 'cyl', 'lleida': 'cat', 'lugo': 'gal', 'madrid': 'mad',
  'malaga': 'and', 'melilla': 'mel', 'murcia': 'mur', 'navarra': 'nav',
  'ourense': 'gal', 'palencia': 'cyl', 'pontevedra': 'gal', 'salamanca': 'cyl',
  'tenerife': 'can', 'segovia': 'cyl', 'sevilla': 'and', 'soria': 'cyl',
  'tarragona': 'cat', 'teruel': 'ara', 'toledo': 'clm', 'valencia': 'val',
  'valladolid': 'cyl', 'bizkaia': 'pva', 'zamora': 'cyl', 'zaragoza': 'ara',
}

const CITY_PROVINCE: Record<string, string> = {
  'sevilla': 'sevilla', 'malaga': 'malaga', 'granada': 'granada', 'cordoba': 'cordoba',
  'cadiz': 'cadiz', 'huelva': 'huelva', 'almeria': 'almeria', 'jaen': 'jaen',
  'barcelona': 'barcelona', 'girona': 'girona', 'lleida': 'lleida', 'tarragona': 'tarragona',
  'madrid': 'madrid', 'valencia': 'valencia', 'alicante': 'alicante', 'castellon': 'castellon',
  'bilbao': 'bizkaia', 'vitoria': 'alava', 'san sebastian': 'gipuzkoa',
  'zaragoza': 'zaragoza', 'huesca': 'huesca', 'teruel': 'teruel',
  'palma': 'baleares', 'mahon': 'baleares', 'ibiza': 'baleares',
  'las palmas': 'las palmas', 'santa cruz': 'tenerife',
  'santiago': 'coruña', 'coruña': 'coruña', 'vigo': 'pontevedra', 'lugo': 'lugo',
  'murcia': 'murcia', 'cartagena': 'murcia',
  'pamplona': 'navarra', 'logroño': 'rioja',
  'oviedo': 'asturias', 'gijon': 'asturias',
  'santander': 'cantabria', 'toledo': 'toledo',
  'badajoz': 'badajoz', 'caceres': 'caceres',
  'albacete': 'albacete', 'ciudad real': 'ciudad real', 'cuenca': 'cuenca', 'guadalajara': 'guadalajara',
  'leon': 'leon', 'burgos': 'burgos', 'salamanca': 'salamanca',
  'valladolid': 'valladolid', 'palencia': 'palencia', 'zamora': 'zamora',
  'avila': 'avila', 'segovia': 'segovia', 'soria': 'soria',
  'ceuta': 'ceuta', 'melilla': 'melilla',
}

export function detectTheme(city?: string | null): ThemeId {
  if (!city) return 'light'
  const c = city.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const province = CITY_PROVINCE[c] ?? c
  return PROVINCE_TO_COMMUNITY[province] ?? 'light'
}

export function getTheme(themeId: ThemeId) {
  return THEMES[themeId] ?? THEMES.light
}
