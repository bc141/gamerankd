# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - link "Home" [ref=e6] [cursor=pointer]:
            - /url: /
            - text: gamdit
          - navigation [ref=e7]:
            - link "Home" [ref=e8] [cursor=pointer]:
              - /url: /
        - generic [ref=e12]:
          - img [ref=e14]
          - search "Search games or players" [ref=e16]
        - link "Sign in" [ref=e18] [cursor=pointer]:
          - /url: /login
    - main [ref=e19]:
      - main [ref=e20]:
        - heading "Search" [level=1] [ref=e21]
        - generic [ref=e22]:
          - generic [ref=e23]:
            - img [ref=e25]
            - textbox "Search" [ref=e27]
          - generic [ref=e28]:
            - button "All" [pressed] [ref=e29]
            - button "Games" [ref=e30]
            - button "Users" [ref=e31]
  - button "Open Next.js Dev Tools" [ref=e37] [cursor=pointer]:
    - img [ref=e38] [cursor=pointer]
  - alert [ref=e41]
```