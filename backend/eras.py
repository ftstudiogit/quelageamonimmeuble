"""Periodes architecturales parisiennes — 10 tranches.

Chaque tranche fournit le label (ligne d'époque sous l'année) et le paragraphe
de contexte architectural générique. Indépendant de l'adresse.
"""

ERAS = [
    {
        "max_year": 1788,
        "label": "Sous l'Ancien Régime",
        "context": (
            "Paris d'avant la Révolution reste largement médiéval : rues étroites, "
            "maisons à pans de bois, hôtels particuliers pour l'aristocratie dans le "
            "Marais et le faubourg Saint-Germain. Les immeubles de rapport en pierre, "
            "quatre à cinq étages, apparaissent sous Louis XV. Aucune réglementation "
            "stricte des façades : chaque propriétaire bâtit selon ses moyens et les "
            "usages du quartier."
        ),
    },
    {
        "max_year": 1829,
        "label": "Entre Révolution et Restauration",
        "context": (
            "L'époque révolutionnaire puis napoléonienne construit peu : la ville "
            "digère la vente des biens nationaux. Sous l'Empire, Percier et Fontaine "
            "imposent un néoclassicisme sobre — colonnes, frontons, décor mesuré. "
            "Les immeubles de rapport adoptent progressivement la pierre de taille "
            "et une hauteur réglementée, préfigurant l'ordonnance haussmannienne."
        ),
    },
    {
        "max_year": 1852,
        "label": "Sous la Monarchie de Juillet, avant Haussmann",
        "context": (
            "Paris grossit vite sans plan d'ensemble et atteint 1,2 million "
            "d'habitants en 1852. Les immeubles de rapport se multiplient : cinq à "
            "six étages en moellons enduits, sans ascenseur, avec des cours "
            "profondes où s'entassent ateliers et logements ouvriers. Le décor reste "
            "économe, les matériaux médiocres — c'est le Paris insalubre que "
            "Haussmann s'apprête à éventrer."
        ),
    },
    {
        "max_year": 1870,
        "label": "Plein Haussmann, apogée du Second Empire",
        "context": (
            "Sous la préfecture du baron Haussmann, Paris devient une capitale "
            "moderne. Les percements rectilignes imposent un modèle d'immeuble "
            "devenu canon : pierre de taille pleine hauteur, rez-de-chaussée "
            "commercial, entresol, étage noble au deuxième avec balcon filant, "
            "étages courants, combles à la Mansart en zinc. L'alignement strict des "
            "façades et la hauteur réglementée créent l'unité visuelle de la ville."
        ),
    },
    {
        "max_year": 1899,
        "label": "Sous la IIIᵉ République, après Haussmann",
        "context": (
            "Les chantiers haussmanniens s'achèvent — boulevard Saint-Germain, "
            "avenue de l'Opéra — mais le code se relâche. Les façades gagnent en "
            "exubérance décorative : bow-windows, sculptures, loggias, brique et "
            "pierre mêlées. Les architectes signent leurs immeubles, chose "
            "impensable vingt ans plus tôt. Le plan-type haussmannien s'assouplit "
            "sans disparaître."
        ),
    },
    {
        "max_year": 1918,
        "label": "Belle Époque, plein Art nouveau",
        "context": (
            "L'Exposition universelle de 1900 consacre un style nouveau : lignes "
            "végétales, ferronneries travaillées, céramiques en façade, asymétries "
            "assumées. Guimard, Lavirotte et Plumet signent des immeubles-"
            "manifestes dans l'ouest parisien. Le mouvement reste minoritaire face à "
            "la production courante mais marque une rupture esthétique avec "
            "l'académisme haussmannien."
        ),
    },
    {
        "max_year": 1939,
        "label": "Entre-deux-guerres, Art déco",
        "context": (
            "Après la guerre, l'Art déco prend le dessus : pierre blanche, "
            "bow-windows géométriques, ferronneries stylisées, lignes horizontales "
            "marquées. L'Exposition internationale de 1925 en fixe le vocabulaire. "
            "En parallèle, le mouvement moderne pointe avec Mallet-Stevens et "
            "Le Corbusier — façade libre, béton armé, toitures-terrasses — encore "
            "minoritaire."
        ),
    },
    {
        "max_year": 1959,
        "label": "Années de reconstruction",
        "context": (
            "La France d'après-guerre bâtit vite et peu cher : béton armé, panneaux "
            "préfabriqués, ascenseur devenu standard, normes de confort nouvelles "
            "(cuisine équipée, salle de bain, chauffage central). À Paris, la "
            "Reconstruction touche surtout les friches industrielles et les îlots "
            "insalubres déclassés. L'ornement disparaît au profit de volumes simples "
            "et d'une rationalité constructive."
        ),
    },
    {
        "max_year": 1980,
        "label": "Trente Glorieuses",
        "context": (
            "L'État planifie la modernisation : ZUP, ZAC, barres et tours dans les "
            "arrondissements périphériques, rénovation des quartiers anciens. Le "
            "Front de Seine, la tour Montparnasse et le 13ᵉ arrondissement incarnent "
            "cette ambition. La loi Malraux (1962) et les secteurs sauvegardés "
            "freinent la table rase dans le Paris historique ; la critique monte et "
            "imposera une révision du modèle dans les années 1980."
        ),
    },
    {
        "max_year": 9999,
        "label": "Paris contemporain",
        "context": (
            "La production architecturale privilégie désormais la couture urbaine : "
            "hauteurs contenues, façades variées, matériaux mixtes (verre, métal, "
            "béton lasuré), attention aux ambiances de rue. Les grands projets "
            "présidentiels (Opéra Bastille, BnF, musée du Quai Branly) cohabitent "
            "avec une densification raisonnée. Les normes environnementales pèsent "
            "de plus en plus sur le dessin et les matériaux."
        ),
    },
]


def classify(year: int) -> dict:
    """Return {label, context} for the era containing the given year."""
    for era in ERAS:
        if year <= era["max_year"]:
            return {"label": era["label"], "context": era["context"]}
    return {"label": ERAS[-1]["label"], "context": ERAS[-1]["context"]}
