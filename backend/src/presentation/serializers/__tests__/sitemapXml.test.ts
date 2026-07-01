import { renderSitemapXml } from '../sitemapXml';

describe('renderSitemapXml', () => {
  it('should_produce_valid_xml_with_urlset_root_and_xml_declaration', () => {
    const xml = renderSitemapXml([{ loc: 'https://mavile.es/catalog' }]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('</urlset>');
  });

  it('should_render_one_url_element_per_entry', () => {
    const xml = renderSitemapXml([
      { loc: 'https://mavile.es/catalog' },
      { loc: 'https://mavile.es/catalog/1' },
    ]);
    expect(xml.match(/<url>/g)).toHaveLength(2);
  });

  it('should_omit_lastmod_element_when_entry_has_no_lastmod', () => {
    const xml = renderSitemapXml([{ loc: 'https://mavile.es/catalog' }]);
    expect(xml).not.toContain('<lastmod>');
  });

  it('should_include_lastmod_element_when_entry_has_lastmod', () => {
    const xml = renderSitemapXml([
      { loc: 'https://mavile.es/catalog/1', lastmod: '2026-05-01T10:00:00.000Z' },
    ]);
    expect(xml).toContain('<lastmod>2026-05-01T10:00:00.000Z</lastmod>');
  });

  it('should_escape_xml_special_characters_in_loc', () => {
    const xml = renderSitemapXml([{ loc: 'https://mavile.es/catalog?a=1&b=2' }]);
    expect(xml).toContain('https://mavile.es/catalog?a=1&amp;b=2');
    expect(xml).not.toContain('a=1&b=2');
  });
});
