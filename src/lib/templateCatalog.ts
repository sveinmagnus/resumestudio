// Catalog of resume sections that can be included in an export template,
// plus which fields each section makes available.

export interface SectionFieldDef {
  key: string
  label: string
}

export interface SectionCatalogEntry {
  key: string                // matches a key in ExportTemplate.sections
  label: string              // default heading shown to user
  storeKey: string           // data store array name
  fields: SectionFieldDef[]  // selectable fields per item in this section
  defaultFields: string[]    // pre-checked by default
}

export const SECTION_CATALOG: SectionCatalogEntry[] = [
  {
    key: 'header',
    label: 'Personal details',
    storeKey: 'resume',
    fields: [
      { key: 'full_name', label: 'Full name' },
      { key: 'title', label: 'Professional title' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'nationality', label: 'Nationality' },
      { key: 'place_of_residence', label: 'Place of residence' },
      { key: 'date_of_birth', label: 'Date of birth' },
      { key: 'linkedin_url', label: 'LinkedIn' },
      { key: 'website_url', label: 'Website' },
      { key: 'profile_image', label: 'Profile photo' },
    ],
    defaultFields: ['full_name', 'title', 'email', 'phone', 'place_of_residence'],
  },
  {
    key: 'key_qualifications',
    label: 'Profile & summary',
    storeKey: 'key_qualifications',
    fields: [
      { key: 'label', label: 'Section label' },
      { key: 'tag_line', label: 'Tag line' },
      { key: 'summary', label: 'Summary text' },
      { key: 'key_points', label: 'Key competency points' },
    ],
    defaultFields: ['summary', 'key_points'],
  },
  {
    key: 'projects',
    label: 'Projects',
    storeKey: 'projects',
    fields: [
      { key: 'customer', label: 'Customer name' },
      { key: 'industry', label: 'Industry' },
      { key: 'dates', label: 'Date range' },
      { key: 'description', label: 'Short description' },
      { key: 'long_description', label: 'Customer background' },
      { key: 'roles', label: 'Roles & responsibilities' },
      { key: 'skills', label: 'Skills used' },
      { key: 'highlights', label: 'Highlights / bullets' },
      { key: 'team_size', label: 'Team size' },
      { key: 'allocation', label: 'Allocation %' },
    ],
    defaultFields: ['customer', 'industry', 'dates', 'long_description', 'roles', 'skills'],
  },
  {
    key: 'work_experiences',
    label: 'Employment',
    storeKey: 'work_experiences',
    fields: [
      { key: 'employer', label: 'Employer' },
      { key: 'role_title', label: 'Role / title' },
      { key: 'dates', label: 'Date range' },
      { key: 'long_description', label: 'Description' },
      { key: 'roles', label: 'Roles' },
      { key: 'skills', label: 'Skills used' },
      { key: 'employment_type', label: 'Employment type' },
    ],
    defaultFields: ['employer', 'role_title', 'dates', 'long_description'],
  },
  {
    key: 'educations',
    label: 'Education',
    storeKey: 'educations',
    fields: [
      { key: 'school', label: 'Institution' },
      { key: 'degree', label: 'Degree' },
      { key: 'description', label: 'Specialisation' },
      { key: 'dates', label: 'Date range' },
      { key: 'grade', label: 'Grade / result' },
    ],
    defaultFields: ['school', 'degree', 'dates'],
  },
  {
    key: 'courses',
    label: 'Courses',
    storeKey: 'courses',
    fields: [
      { key: 'name', label: 'Course name' },
      { key: 'program', label: 'Provider' },
      { key: 'completed', label: 'Date' },
      { key: 'description', label: 'Description' },
    ],
    defaultFields: ['name', 'program', 'completed'],
  },
  {
    key: 'certifications',
    label: 'Certifications',
    storeKey: 'certifications',
    fields: [
      { key: 'name', label: 'Certification' },
      { key: 'organiser', label: 'Issuer' },
      { key: 'issued', label: 'Issued date' },
      { key: 'expires', label: 'Expiry date' },
      { key: 'credential_url', label: 'Credential URL' },
    ],
    defaultFields: ['name', 'organiser', 'issued'],
  },
  {
    key: 'technology_categories',
    label: 'Skills showcase',
    storeKey: 'technology_categories',
    fields: [
      { key: 'name', label: 'Category name' },
      { key: 'skills', label: 'Skill list' },
      { key: 'proficiency', label: 'Show proficiency' },
      { key: 'experience', label: 'Show total experience' },
    ],
    defaultFields: ['name', 'skills'],
  },
  {
    key: 'spoken_languages',
    label: 'Languages',
    storeKey: 'spoken_languages',
    fields: [
      { key: 'name', label: 'Language' },
      { key: 'level', label: 'Proficiency' },
    ],
    defaultFields: ['name', 'level'],
  },
  {
    key: 'positions',
    label: 'Positions & volunteering',
    storeKey: 'positions',
    fields: [
      { key: 'name', label: 'Position' },
      { key: 'organisation', label: 'Organisation' },
      { key: 'dates', label: 'Date range' },
      { key: 'description', label: 'Description' },
    ],
    defaultFields: ['name', 'organisation', 'dates'],
  },
  {
    key: 'presentations',
    label: 'Presentations',
    storeKey: 'presentations',
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'event', label: 'Event / venue' },
      { key: 'date', label: 'Date' },
      { key: 'description', label: 'Abstract' },
      { key: 'url', label: 'URL' },
    ],
    defaultFields: ['title', 'event', 'date'],
  },
  {
    key: 'publications',
    label: 'Publications',
    storeKey: 'publications',
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'publisher', label: 'Publisher' },
      { key: 'date', label: 'Date' },
      { key: 'abstract', label: 'Abstract' },
      { key: 'url', label: 'URL' },
    ],
    defaultFields: ['title', 'publisher', 'date'],
  },
  {
    key: 'honor_awards',
    label: 'Awards',
    storeKey: 'honor_awards',
    fields: [
      { key: 'name', label: 'Award' },
      { key: 'issuer', label: 'Issuer' },
      { key: 'date', label: 'Date' },
      { key: 'description', label: 'Description' },
    ],
    defaultFields: ['name', 'issuer', 'date'],
  },
  {
    key: 'references',
    label: 'References',
    storeKey: 'references',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'title', label: 'Title' },
      { key: 'company', label: 'Company' },
      { key: 'relationship', label: 'Relationship' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
    ],
    defaultFields: ['name', 'title', 'company', 'relationship'],
  },
]

export const FONT_CHOICES = [
  { value: 'DM Serif Display', label: 'DM Serif Display (serif)' },
  { value: 'Georgia', label: 'Georgia (serif)' },
  { value: 'Times New Roman', label: 'Times New Roman (serif)' },
  { value: 'DM Sans', label: 'DM Sans (sans-serif)' },
  { value: 'Inter', label: 'Inter (sans-serif)' },
  { value: 'Calibri', label: 'Calibri (sans-serif)' },
  { value: 'Arial', label: 'Arial (sans-serif)' },
  { value: 'Helvetica', label: 'Helvetica (sans-serif)' },
]

export function defaultTemplateSections(): { key: string; enabled: boolean; heading: null; fields: string[] }[] {
  return SECTION_CATALOG.map((c) => ({
    key: c.key,
    enabled: ['header', 'key_qualifications', 'projects', 'work_experiences', 'educations', 'certifications', 'technology_categories', 'spoken_languages'].includes(c.key),
    heading: null,
    fields: [...c.defaultFields],
  }))
}
