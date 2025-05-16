import React, { useState } from "react";
import Tag from "./Tag";

interface TagInputProps {
  selectedTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}
const predefinedTags = [
    // Programming Languages & Runtimes
    "Python 2.7",
    "Python 3.6",
    "Python 3.7",
    "Python 3.8",
    "Python 3.9",
    "Python 3.10",
    "Python 3.11",
    "Python 3.12",
    "Java 8",
    "Java 11",
    "Java 17",
    "Java 21",
    "NodeJS 14",
    "NodeJS 16",
    "NodeJS 18",
    "NodeJS 20",
    "NodeJS 22",
    "Ruby 2.7",
    "Ruby 3.0",
    "Ruby 3.1",
    "Ruby 3.2",
    "PHP 7.4",
    "PHP 8.0",
    "PHP 8.1",
    "PHP 8.2",
    "PHP 8.3",
    "Go 1.18",
    "Go 1.19",
    "Go 1.20",
    "Go 1.21",
    "Go 1.22",
    "Rust (stable)",
    "Rust (nightly)",
    "C# (.NET Core 3.1)",
    "C# (.NET 5)",
    "C# (.NET 6)",
    "C# (.NET 7)",
    "C# (.NET 8)",
    "F#",
    "Scala 2.12",
    "Scala 2.13",
    "Scala 3",
    "Kotlin",
    "Swift",
    "Objective-C",
    "C",
    "C++ (GCC)",
    "C++ (Clang)",
    "Perl",
    "Lua",
    "R",
    "Erlang",
    "Elixir",
    "Haskell",
    "Clojure",
    "Groovy",
    "Dart",
    "TypeScript",
  
    // Web Frameworks & Libraries (Backend)
    "Spring Framework",
    "Spring Boot",
    "Spring MVC",
    "Spring Data",
    "Spring Security",
    "Django",
    "Flask",
    "FastAPI",
    "Ruby on Rails",
    "Sinatra",
    "Laravel",
    "Symfony",
    "CodeIgniter",
    "Express.js",
    "NestJS",
    "Koa.js",
    "Hapi.js",
    "ASP.NET Core",
    "ASP.NET MVC",
    "Phoenix (Elixir)",
    "Play Framework",
    "Akka",
    "Vert.x",
  
    // Web Frameworks & Libraries (Frontend)
    "React",
    "Angular",
    "Vue.js",
    "Next.js",
    "Nuxt.js",
    "Svelte",
    "Ember.js",
    "Backbone.js",
    "jQuery",
    "Bootstrap",
    "Tailwind CSS",
    "Material-UI",
    "Ant Design",
    "Redux",
    "Vuex",
    "Pinia",
    "Zustand",
    "GraphQL",
    "Webpack",
    "Vite",
    "Parcel",
    "Babel",
  
    // Databases (SQL)
    "MySQL 5.7",
    "MySQL 8.0",
    "PostgreSQL 12",
    "PostgreSQL 13",
    "PostgreSQL 14",
    "PostgreSQL 15",
    "PostgreSQL 16",
    "Microsoft SQL Server",
    "Oracle Database",
    "SQLite",
    "MariaDB",
    "CockroachDB",
  
    // Databases (NoSQL)
    "MongoDB 4",
    "MongoDB 5",
    "MongoDB 6",
    "MongoDB 7",
    "Redis",
    "Memcached",
    "Cassandra",
    "Couchbase",
    "DynamoDB",
    "Elasticsearch",
    "OpenSearch",
    "Solr",
    "InfluxDB",
    "Prometheus",
    "Neo4j",
    "ArangoDB",
  
    // Messaging Queues & Streaming
    "RabbitMQ",
    "Apache Kafka",
    "ActiveMQ",
    "ZeroMQ",
    "NATS",
    "Redis Streams",
  
    // Web Servers & Proxy Servers
    "Apache HTTP Server",
    "Nginx",
    "Caddy",
    "HAProxy",
    "Envoy Proxy",
    "Tomcat",
    "Jetty",
    "WildFly",
    "Undertow",
    "Apache Guacamole",
  
    // Containerization & Orchestration
    "Docker",
    "Podman",
    "Minikube",
    "Kubernetes",
    "Docker Compose",
    "Helm",
  
    // CI/CD & Build Tools
    "Jenkins",
    "GitLab CI",
    "GitHub Actions",
    "CircleCI",
    "Travis CI",
    "Maven",
    "Gradle",
    "Ant",
    "npm",
    "yarn",
    "pnpm",
    "Bazel",
    "SBT",
    "Leiningen",
    "Mix",
    "Cargo",
    "CMake",
    "Make",
  
    // Operating Systems (for context, though the image itself is an OS)
    "Ubuntu",
    "Debian",
    "CentOS",
    "Fedora",
    "Alpine Linux",
    "Amazon Linux",
    "Windows Server", // If applicable for certain .NET dev environments
  
    // Cloud SDKs (for local development/emulation)
    "AWS CLI",
    "Azure SDK",
    "Google Cloud SDK",
  
    // Common Development Tools & Utilities
    "Git",
    "Mercurial",
    "Subversion",
    "Bash",
    "Zsh",
    "PowerShell",
    "Vim",
    "Emacs",
    "Nano",
    "jq",
    "curl",
    "wget",
    "OpenSSL",
    "Terraform",
    "Ansible",
    "Puppet",
    "Chef",
    "Vault",
    "Consul",
    "Etcd",
    "Valgrind",
    "GNU Debugger",
    "LLVM",
    "GNU Compiler Collection",
    "Clang",
    "JDK Mission Control",
    "JProfiler",
    "YourKit",
  
    // Data Science & Machine Learning
    "Jupyter Notebook/Lab",
    "Anaconda",
    "Miniconda",
    "NumPy",
    "Pandas",
    "SciPy",
    "Scikit-learn",
    "TensorFlow",
    "PyTorch",
    "Keras",
    "XGBoost",
    "LightGBM",
    "Spark",
    "Hadoop",
  
    // API & Documentation
    "Swagger",
    "OpenAPI",
    "Postman",
    "MkDocs",
    "Sphinx",
    "Docusaurus"
  ];
  
  // console.log(predefinedTags);
  // console.log(predefinedTags.length); // To see how many we've got

const TagInput: React.FC<TagInputProps> = ({
  selectedTags,
  onAddTag,
  onRemoveTag,
}) => {
  const [tagInput, setTagInput] = useState<string>(""); // Input for tag autocomplete
  const [filteredTags, setFilteredTags] = useState<string[]>(predefinedTags); // Filtered tags for autocomplete

  const handleTagInputChange = (value: string) => {
    setTagInput(value);

    // Filter predefined tags based on input
    const filtered = predefinedTags.filter(
      (tag) =>
        tag.toLowerCase().includes(value.toLowerCase()) &&
        !selectedTags.includes(tag)
    );
    setFilteredTags(filtered);
  };

  const handleTagAdd = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      onAddTag(tag);
    }
    setTagInput(""); // Clear the input after adding a tag
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (tagInput.trim() && filteredTags.includes(tagInput)) {
      handleTagAdd(tagInput.trim());
    }
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="relative">
        {/* Search Icon */}
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            className="w-5 h-5 text-gray-400 dark:text-gray-500"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35m0 0a7.5 7.5 0 1 0-10.6 0 7.5 7.5 0 0 0 10.6 0z"
            />
          </svg>
        </div>

        {/* Tag Input */}
        <input
          type="text"
          placeholder="Add a tag..."
          value={tagInput}
          onChange={(e) => handleTagInputChange(e.target.value)}
          className="dark:bg-dark-900 h-[42px] w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pl-[42px] pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
        />

        {/* Autocomplete Dropdown */}
        {tagInput && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg dark:bg-gray-800 dark:border-gray-700">
            {filteredTags.length > 0 ? (
              filteredTags.map((tag) => (
                <div
                  key={tag}
                  onClick={() => handleTagAdd(tag)}
                  className="px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <span className="text-gray-700 text-theme-sm dark:text-gray-400">{tag}</span>
                </div>
              ))
            ) : (
              <div className="px-4 py-2 text-gray-500 dark:text-gray-400">
                No tags found
              </div>
            )}
          </div>
        )}
      </form>

      {/* Render Tags Below Input */}
      <div className="flex flex-wrap gap-2 mt-2">
        {selectedTags.map((tag) => (
          <Tag key={tag} name={tag} onRemove={() => onRemoveTag(tag)} />
        ))}
      </div>
    </div>
  );
};

export default TagInput;