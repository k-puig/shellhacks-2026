{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        # Dev shells
        devShells = {
          default = pkgs.mkShell {
            buildInputs =
              with pkgs;
              pkgs.lib.optionals (system == "x86_64-linux") [ zed-editor-fhs ]
              ++ [
                deno
                nodejs_26
                ffmpeg-full

                (python314.withPackages (
                  python-pkgs: with python-pkgs; [
                    fastapi
                    kokoro
                    ebooklib
                    python-multipart
                    uvicorn
                  ]
                ))

                nil
                nixd
                nginx-language-server
              ];
          };

          prod = pkgs.mkShell {
            buildInputs = with pkgs; [ deno ];
          };
        };
      }
    );
}
