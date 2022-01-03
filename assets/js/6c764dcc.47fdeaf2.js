(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([[503],{9558:function(e,n,t){"use strict";t.r(n),t.d(n,{frontMatter:function(){return i},metadata:function(){return l},toc:function(){return s},default:function(){return d}});var o=t(2122),a=t(9756),r=(t(7294),t(3905)),i={slug:"A progressive micro frontends framework - Fronts",title:"A progressive micro frontends framework - Fronts",author:"unadlib",tags:["fronts"]},l={permalink:"/blog/A progressive micro frontends framework - Fronts",editUrl:"https://github.com/unadlib/fronts/edit/master/website/blog/blog/2021-07-04-a-progressive-micro-frontends-framework-fronts.md",source:"@site/blog/2021-07-04-a-progressive-micro-frontends-framework-fronts.md",title:"A progressive micro frontends framework - Fronts",description:"Micro Frontends",date:"2021-07-04T00:00:00.000Z",formattedDate:"July 4, 2021",tags:[{label:"fronts",permalink:"/blog/tags/fronts"}],readingTime:10.04,truncated:!1},s=[{value:"Micro Frontends",id:"micro-frontends",children:[]},{value:"Benefits and Value of Micro Frontends",id:"benefits-and-value-of-micro-frontends",children:[]},{value:"Motivation",id:"motivation",children:[]},{value:"Hotspots of Micro Frontends Framework",id:"hotspots-of-micro-frontends-framework",children:[]},{value:"What&#39;s Fronts",id:"whats-fronts",children:[]},{value:"Benefits of Fronts",id:"benefits-of-fronts",children:[]},{value:"Example",id:"example",children:[]},{value:"Notes",id:"notes",children:[]},{value:"Conclusion",id:"conclusion",children:[]}],p={toc:s};function d(e){var n=e.components,t=(0,a.Z)(e,["components"]);return(0,r.kt)("wrapper",(0,o.Z)({},p,t,{components:n,mdxType:"MDXLayout"}),(0,r.kt)("h2",{id:"micro-frontends"},"Micro Frontends"),(0,r.kt)("blockquote",null,(0,r.kt)("p",{parentName:"blockquote"},"An architectural style where independently deliverable frontend applications are composed into a greater whole.")),(0,r.kt)("p",null,"As front-end development becomes increasingly complex, traditional large front-end projects should likely end up being difficult to maintain due to over-coupling, and therefore Micro Frontends is also gaining attention in front-end architectures."),(0,r.kt)("p",null,"Front-end application modules dynamic will become one of the new trends in front-end development, and it will be possible to solve the problem of code base maintainability and delivery efficiency more thoroughly."),(0,r.kt)("h2",{id:"benefits-and-value-of-micro-frontends"},"Benefits and Value of Micro Frontends"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Independence and Autonomy")),(0,r.kt)("p",null,"Only if the overall process of application development can be developed, deployed and managed independently of the code base, etc., then the front-end project can have true independence guaranteed. And this possibility of team autonomy is also in line with Conway's Law, which states that \"Any organization that designs a system (defined broadly) will produce a design whose structure is a copy of the organization's communication structure\", thus bringing about a possible new form of organizational management."),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Technology Agnostic")),(0,r.kt)("p",null,"Technology agnostic facilitates the collaboration of multiple teams with different technology stacks. The smooth migration of technology stacks also brings greater convenience to the continuous iteration and technology upgrade of the older business system."),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Runtime Integration")),(0,r.kt)("p",null,"In modern front-end development processes, we most often see build-time integration. Whereas before, runtime integration happened to separate modules more independently. Micro frontends also happen to integrate well with such micro module concepts and keep such modules independent and dependency sharing."),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Decoupled Modularity & Composable")),(0,r.kt)("p",null,"In large front-end projects, we have high requirements for modular decoupling, often based on different types of divisions, such as business type modularity, technical service type modularity, and so on. The composable of individual micro frontends particles in turn allows for good module consistency and overall customization differentiation across multiple deliverable families, and can greatly reduce business duplication."),(0,r.kt)("p",null,"In general, the proper practice of micro frontends architecture will bring far-reaching value to the long-term maintenance of some large front-end projects."),(0,r.kt)("h2",{id:"motivation"},"Motivation"),(0,r.kt)("p",null,"Among the many micro frontends solutions, single-spa and Module Federation are the best of them."),(0,r.kt)("p",null,"single-spa is a micro frontends framework based on router configuration. The centralization of configuration brings some limitations, such as it is difficult to granulate nestable micro frontends, module granularity control, module sharing, and so on."),(0,r.kt)("p",null,"In 2019, Zack Jackson proposed and implemented Module Federation. Module Federation is a completely different concept from single-spa, and allows a JavaScript application to dynamically load code from another application. It completely solves the problem of code dependency sharing and runtime modularity. The idea is true - A game-changer in JavaScript architecture as mentioned in Zack Jackson's article. And it's currently supported by Webpack, Next.js, and Rollup."),(0,r.kt)("p",null,"Although the Module Federation concept is so amazing, it has not yet gone further to provide a more complete and fully targeted micro frontends framework implementation, and this is what Fronts is trying to do."),(0,r.kt)("h2",{id:"hotspots-of-micro-frontends-framework"},"Hotspots of Micro Frontends Framework"),(0,r.kt)("p",null,"Based on the current mainstream micro frontends frameworks or concepts, the following is a compilation of the main hotspots involved."),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Should the granularity level be application level or module level")),(0,r.kt)("p",null,"Module level is obviously more advantageous in terms of flexibility and granularity, but there is clearly an advantage to supporting application level in order to be compatible with some not so modern front-end projects, so we need a framework that supports both. If application-level runtime integration is required, it is clear that just using Module Federation's Webpack is not enough, we also need a runtime application-level granular entry point loader."),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Whether the entry point file is HTML or JavaScript")),(0,r.kt)("p",null,"From a modern engineering perspective, most front-end application entry points are JS-based, and some previous front-end projects have used HTML alone as the entry point. The trade-off is that building a micro frontends system for applications where HTML is the main entry point is bound to be a longer and more complex of processes. Such a library would be better suited as a standalone sub-package, while the overall framework should take JS files as the entry point."),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Is it necessary to support perfect module sharing")),(0,r.kt)("p",null,"Module sharing is a problem that must be solved by micro frontends frameworks, otherwise the duplication of resources at runtime will make micro frontends less valuable. Currently, only Webpack with Module Federation allows such module sharing to be handled at build time, with dynamic dependency sharing at runtime. No better solution than Module Federation has yet emerged."),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"CSS/JS isolation trade-off")),(0,r.kt)("p",null,"Isolation of CSS is almost required and is supported by many micro frontends frameworks. We may have to do all kinds of hijacking to ensure the security, performance and stability, and also consider the compatibility of different browsers. However, JS isolation is relatively expensive to implement, and the fact that such isolation is required for modern front-end engineering depends on the actual situation of each micro frontend."),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Generic micro frontend and support multiple containers with multiple modes (Or SSR, etc.)")),(0,r.kt)("p",null,"In large front-end projects, it is often not just about building a single web application, but possibly multiple web applications, or even more front-end application types, such as Electron applications, browser extensions, native applications, etc. So a good micro frontends framework should be able to run more kinds of containers and build a variety of application types, but also preferably compatible with building traditional SPA and micro frontends applications. Module Federation also initially implemented in the next.js implementation of SSR support."),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Version control and dependency management")),(0,r.kt)("p",null,"With rapid iteration and business growth, various module management becomes very important, so when a large front-end project practices micro frontends architecture at a later stage, version control and dependency management will become especially important, which will determine the delivery efficiency and maintainability."),(0,r.kt)("p",null,"To solve these problems, Fronts was created."),(0,r.kt)("h2",{id:"whats-fronts"},"What's Fronts"),(0,r.kt)("p",null,"Fronts is a progressive micro frontends framework for building Web applications, and it's based on the module federation of Webpack."),(0,r.kt)("p",null,"Repo: ",(0,r.kt)("a",{parentName:"p",href:"https://github.com/unadlib/fronts"},"https://github.com/unadlib/fronts")),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Non-module-federation")," - Although Fronts is based on the concept of module federation, it also supports ",(0,r.kt)("inlineCode",{parentName:"li"},"non-module-federation")," mode."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Decentralized configuration")," - Configure ",(0,r.kt)("inlineCode",{parentName:"li"},"site.json")," for dependency management in each Fronts app, support for nested micro frontends."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Cross frameworks")," - No framework or technology stack is restricted."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Code splitting & lazy loading")," - Support code splitting within the Fronts app as a module, it can be lazy loaded by other Fronts app as a dependent module."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"CSS isolation")," - Optional CSS isolation solution."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Lifecycle")," - Fronts provide concise lifecycle for Fronts app entry."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Web Components & iFrame")," - Support for multiple frontend containers."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Multiple patterns")," - Support for building ",(0,r.kt)("inlineCode",{parentName:"li"},"micro-frontends")," app and ",(0,r.kt)("inlineCode",{parentName:"li"},"non-micro-frontends")," app."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Monorepo & TypeScript")," - Friendly support for Monorepo and TypeScript, which are mutually appropriate technology stack."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Version control")," - It's used for efficient and dynamic delivery apps such as canary release."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Zero hijacking")," - Fronts didn't do any hijacking, maintaining originality and possible loss of performance and security."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("strong",{parentName:"li"},"Generic Communication")," - Fronts provides concise and generic communication APIs, which supports almost all frontend environments.")),(0,r.kt)("h2",{id:"benefits-of-fronts"},"Benefits of Fronts"),(0,r.kt)("p",null,(0,r.kt)("strong",{parentName:"p"},"Fronts is a concise and easy to understand micro frontends framework.")),(0,r.kt)("p",null,"Set ",(0,r.kt)("inlineCode",{parentName:"p"},"site.json")," to define a micro frontend, similar to a ",(0,r.kt)("inlineCode",{parentName:"p"},"package.json")," in Node.js."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-json"},'{\n  "name": "app1",\n  "exports": ["./src/bootstrap"],\n  "dependencies": {\n    // If version control is enabled,\n    // here it looks like: `"app2": "1.0.0"`\n    "app2": "http://localhost:3002/remoteEntry.js"\n  },\n  "shared": {\n    "react": { "singleton": true },\n    "react-dom": { "singleton": true }\n  }\n}\n')),(0,r.kt)("p",null,(0,r.kt)("strong",{parentName:"p"},"Fronts is progressive.")),(0,r.kt)("p",null,"If every front-end application does not support Module Federation, it will still work well as a micro frontend, with on-demand runtime modes, and as projects are upgraded, they can gradually be made to support Module Federation and eventually version control can be enabled. With support for multiple granularity levels, build types, module types, shared types, runtime types, and communication types, Fronts can almost meet all kinds of micro frontends architectures."),(0,r.kt)("p",null,(0,r.kt)("strong",{parentName:"p"},"Fronts APIs are clean and simple.")),(0,r.kt)("p",null,"Fronts provides three sets of loaders ",(0,r.kt)("inlineCode",{parentName:"p"},"useApp()"),", ",(0,r.kt)("inlineCode",{parentName:"p"},"useWebComponents()")," and ",(0,r.kt)("inlineCode",{parentName:"p"},"useIframe()"),". It also provides an micro frontend launcher ",(0,r.kt)("inlineCode",{parentName:"p"},"boot()")," and a Webpack configuration generator ",(0,r.kt)("inlineCode",{parentName:"p"},"createWebpackConfig()"),". With these APIs, you will be able to do micro frontends development quickly and efficiently."),(0,r.kt)("h2",{id:"example"},"Example"),(0,r.kt)("p",null,"We will build a micro frontends project based on Fronts, where ",(0,r.kt)("inlineCode",{parentName:"p"},"app1")," is the main entry point and it will depend on ",(0,r.kt)("inlineCode",{parentName:"p"},"app2"),"."),(0,r.kt)("blockquote",null,(0,r.kt)("p",{parentName:"blockquote"},"You can follow this article(",(0,r.kt)("a",{parentName:"p",href:"https://dev.to/rogeliosamuel621/react-without-create-react-app-webpack-5-1b1o"},"React without create-react-app Webpack 5"),") to quickly create ",(0,r.kt)("inlineCode",{parentName:"p"},"app1")," and ",(0,r.kt)("inlineCode",{parentName:"p"},"app2")," React projects.")),(0,r.kt)("p",null,"Assuming you've completed these steps, let's get started with a quick taste of the wonderful micro frontends development of Fronts."),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Install ",(0,r.kt)("inlineCode",{parentName:"li"},"fronts-react")," and ",(0,r.kt)("inlineCode",{parentName:"li"},"fronts-bundler")," in the projects.")),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-shell"},"# with NPM\nnpm install fronts-react fronts-bundler\n\n# or with Yarn\nyarn add fronts-react fronts-bundler\n")),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Set up ",(0,r.kt)("inlineCode",{parentName:"li"},"site.json")," and ",(0,r.kt)("inlineCode",{parentName:"li"},"webpack.config.js")," in the projects")),(0,r.kt)("p",null,"We define ",(0,r.kt)("inlineCode",{parentName:"p"},"app1")," as a parent micro frontend and it depends on ",(0,r.kt)("inlineCode",{parentName:"p"},"app2"),"."),(0,r.kt)("p",null,(0,r.kt)("inlineCode",{parentName:"p"},"app1/site.json"),":"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-json"},'{\n  "name": "app1",\n  "exports": [],\n  "dependencies": {\n    "app2": "http://localhost:3002/remoteEntry.js"\n  }\n}\n')),(0,r.kt)("p",null,(0,r.kt)("inlineCode",{parentName:"p"},"app2")," doesn't have any dependencies, it acts as a micro frontend and we define it to export ",(0,r.kt)("inlineCode",{parentName:"p"},"./src/bootstrap")," as a micro frontends entry, this entry of ",(0,r.kt)("inlineCode",{parentName:"p"},"app2")," end will be used by ",(0,r.kt)("inlineCode",{parentName:"p"},"app1"),"."),(0,r.kt)("p",null,(0,r.kt)("inlineCode",{parentName:"p"},"app2/site.json"),":"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-json"},'{\n  "name": "app2",\n  "exports": ["./src/bootstrap"],\n  "dependencies": {}\n}\n')),(0,r.kt)("p",null,"Wrap the Webpack config with ",(0,r.kt)("inlineCode",{parentName:"p"},"createWebpackConfig()")," in ",(0,r.kt)("inlineCode",{parentName:"p"},"config/webpack.config.js")," in the projects."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-js"},"const { createWebpackConfig } = require('fronts-bundler');\n\nmodule.exports = createWebpackConfig(originalWebpackConfig);\n")),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Define the default exported bootstrap function in ",(0,r.kt)("inlineCode",{parentName:"li"},"app2/src/bootstrap.jsx")," and use ",(0,r.kt)("inlineCode",{parentName:"li"},"boot()")," to get it booted.")),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-jsx"},"import React from 'react';\nimport ReactDOM from 'react-dom';\nimport { boot } from 'fronts-react';\nimport App from './App';\n\nexport default function render(element) {\n  ReactDOM.render(<App />, element);\n  return () => {\n    ReactDOM.unmountComponentAtNode(element);\n  };\n}\n\nboot(render, document.getElementById('root'));\n")),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Load ",(0,r.kt)("inlineCode",{parentName:"li"},"app1/src/App.jsx")," with ",(0,r.kt)("inlineCode",{parentName:"li"},"useApp()")," to import ",(0,r.kt)("inlineCode",{parentName:"li"},"app2"),".")),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-jsx"},"import React from 'react';\nimport { useApp } from 'fronts-react';\n\nexport const App = () => {\n  const App2 = useApp({\n    name: 'app2',\n    loader: () => import('app2/src/bootstrap'),\n  });\n  return <App2 />;\n};\n")),(0,r.kt)("p",null,"Run ",(0,r.kt)("inlineCode",{parentName:"p"},"yarn start"),", and ",(0,r.kt)("inlineCode",{parentName:"p"},"app2")," is rendered as a micro frontend on ",(0,r.kt)("inlineCode",{parentName:"p"},"app1"),"."),(0,r.kt)("p",null,"Example repo\uff1a",(0,r.kt)("a",{parentName:"p",href:"https://github.com/unadlib/fronts-example"},"https://github.com/unadlib/fronts-example")),(0,r.kt)("h2",{id:"notes"},"Notes"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Built-in packages")),(0,r.kt)("p",null,"The mainstream front-end frameworks are still React, Vue and Angular. When a micro frontend uses one of them, it is recommended to use Fronts' built-in packages, such as ",(0,r.kt)("inlineCode",{parentName:"p"},"fronts-react"),", ",(0,r.kt)("inlineCode",{parentName:"p"},"fronts-vue")," and ",(0,r.kt)("inlineCode",{parentName:"p"},"fronts-ng"),", and when it comes to other frameworks not supported by the built-in packages or no framework, then please use ",(0,r.kt)("inlineCode",{parentName:"p"},"fronts"),"."),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Built-in Package API")),(0,r.kt)("p",null,"Each built-in package contains three sets of loaders ",(0,r.kt)("inlineCode",{parentName:"p"},"useApp()"),", ",(0,r.kt)("inlineCode",{parentName:"p"},"useWebComponents()"),", ",(0,r.kt)("inlineCode",{parentName:"p"},"useIframe()"),". ",(0,r.kt)("inlineCode",{parentName:"p"},"useApp()")," provides loose CSS isolation, ",(0,r.kt)("inlineCode",{parentName:"p"},"useWebComponents()")," provides strict CSS isolation, and ",(0,r.kt)("inlineCode",{parentName:"p"},"useIframe()")," provides native strict CSS isolation and JS isolation."),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Version Control")),(0,r.kt)("p",null,"Fronts does not have full version control suite support and currently only supports self-built registry server."),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Monorepo & TypeScript")),(0,r.kt)("p",null,"Large front-end projects often mean a high level of complexity, so Fronts are well suited for use in a combination of technology stacks like Monorepo and TypeScript. You get a great development experience in type safety, code management and runtime integration. when each micro frontend is used as a Monorepo sub-package, you just run ",(0,r.kt)("inlineCode",{parentName:"p"},"SPA=true yarn start")," and switch the micro frontends development mode to the traditional SPA development mode."),(0,r.kt)("h2",{id:"conclusion"},"Conclusion"),(0,r.kt)("p",null,"The front-end architecture based on Fronts, Monorepo, and TypeScript will significantly improve codebase management, type safety, business development and delivery efficiency, and enable multiple combination of product business capabilities, high reuse and consistency of business code, and diversity of application types."),(0,r.kt)("p",null,"Every large front-end project that tries to implement micro frontends architecture has different or similar requirements, so by analyzing the demands and needs of their own large front-end projects and using them to build or choose their own micro front-end architecture, they can really solve their own main engineering problems."),(0,r.kt)("p",null,"With a general module concept based on Module Federation, Fronts tries to solve the main problems of micro frontends in a more targeted and systematic way, such as cross-framework, dependency sharing, dependency management, version control, compatibility with multiple runtime containers and patterns, etc."),(0,r.kt)("p",null,"Fronts wants to evolve from more micro frontends architecture requirements to an efficient micro frontends framework."),(0,r.kt)("p",null,"Repo: ",(0,r.kt)("a",{parentName:"p",href:"https://github.com/unadlib/fronts"},"https://github.com/unadlib/fronts")))}d.isMDXComponent=!0}}]);