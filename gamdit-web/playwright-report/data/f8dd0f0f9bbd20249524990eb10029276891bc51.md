# Page snapshot

```yaml
- generic [ref=e1]:
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
        - heading "Sign in" [level=1] [ref=e21]
        - generic [ref=e24]:
          - generic [ref=e25]:
            - generic [ref=e26]: Email address
            - textbox "Email address" [active] [ref=e27]
          - button "Send Magic Link" [ref=e28] [cursor=pointer]
  - button "Open Next.js Dev Tools" [ref=e34] [cursor=pointer]:
    - img [ref=e35] [cursor=pointer]
  - alert [ref=e38]
```