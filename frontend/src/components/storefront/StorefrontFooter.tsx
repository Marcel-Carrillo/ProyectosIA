import React from 'react';

const FOOTER_COLUMNS = [
  { title: 'Shop', links: ['Women', 'Men', 'Accessories', 'New arrivals'] },
  { title: 'Help', links: ['Shipping', 'Returns', 'Size guide', 'Contact'] },
  { title: 'Company', links: ['Our story', 'Materials', 'Sustainability', 'Press'] },
] as const;

const StorefrontFooter: React.FC = () => {
  return (
    <footer className="storefront-footer">
      <div className="storefront-footer__grid">
        <div>
          <p className="storefront-footer__brand-title">Mavile</p>
          <p className="storefront-footer__brand-text">
            Timeless pieces made in Europe with noble materials.
          </p>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title}>
            <h4 className="storefront-footer__col-title">{col.title}</h4>
            <ul className="storefront-footer__links">
              {col.links.map((link) => (
                <li key={link}>
                  <button type="button">{link}</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="storefront-footer__bottom">
        <div className="storefront-footer__bottom-inner">
          <span>&copy; {new Date().getFullYear()} Mavile</span>
          <span>Madrid · Lisbon · Paris</span>
        </div>
      </div>
    </footer>
  );
};

export default StorefrontFooter;
