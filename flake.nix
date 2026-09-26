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
            buildInputs = with pkgs; [
              deno
              nodejs_26

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
