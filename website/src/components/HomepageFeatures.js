import React from 'react';
import clsx from 'clsx';
import styles from './HomepageFeatures.module.css';

const FeatureList = [
  {
    title: 'Easy to Use',
    Svg: require('../../static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        Quickly build decentralized micro frontends projects, define a micro frontend by setting <code>site.json</code>, similar to <code>package.json</code> of NPM.
      </>
    ),
  },
  {
    title: 'Progressive',
    Svg: require('../../static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        It supports non-module-federation and allows gradual upgrade to support module federation and enable version control system.
      </>
    ),
  },
  {
    title: 'Concise & Diversity',
    Svg: require('../../static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Provide clean API and support more micro frontends combination capability and provide re-architecture possibilities.
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} alt={title} />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
