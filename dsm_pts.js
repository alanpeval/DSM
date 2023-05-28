/*
INSTITUTO AGRONÔMICO (IAC) - Pós-graduação em Agricultura Tropical e Subtropical.
INSTITUTO DE PESQUISAS TECNOLÓGICAS (IPT) - Programa Novos Talentos.
Código desenvolvido e compartilhado como parte integrante da tese de doutorado de Valadares (2023). VALADARES, A.P. Dados legados de levantamentos pedológicos para mapeamento digital de classes de solos em larga escala para diferentes ambientes pedogenéticos. (Tese de Doutorado) Instituto Agronômico. Campinas, SP. 2023.
ANEXO III - Código Javascript para Mapeamento Digital de Classes de Solos com base em pixels, em larga escala, a partir de pontos de observação do solo em campo, no Google Earth Engine.
*/


//Leitura e tratamento das fontes de informação
  // Limites da área de estudo
  var area = ee.FeatureCollection("projects/iac-mds/assets/limites_area");
  // Conjunto de covariáveis preditivas
  var covar = ee.Image('projects/iac-mds/assets/covar_predit');
  // Conjunto de observações de solo em campo
  var campo = ee.FeatureCollection('projects/iac-mds/assets/pts_campo');
  
  // Separar aleatoriamente parte dos dados de campo para treinamento/teste do classificador e quantificar observações em cada conjunto de dados
  var campo = campo.randomColumn('random', 1);
  var campo_teste = campo.filter(ee.Filter.gte('random', 0.9));
  print(campo_teste.size(),'Pontos selecionados para teste');
  var campo_treino = campo.filter(ee.Filter.lt('random', 0.9));
  print(campo_treino.size(), 'Pontos selecionados para treinamento');

  // Escolher covariáveis que serão utilizadas no treinamento do modelo de classificação supervisionada
  var bands = covar.select(['b1','b2','b3','b4','b5','b6','b7','b8','b9','b10','b11','fei_min','dominio','pc1','pc2','pc3','b1_tx']).bandNames();

  // Criar variáveis para indicar o campo que contém cada nível de classificação de solos para o treinamento e predição. Convenção >> Ordem: classe1; Subordem: classe2; Grande Grupo: classe3; Subgrupo: classe4; Unidade de Solo: classe.
  var classe_solo = 'classe2';
  
   // Exibir gráficos com histogramas dos conjuntos de observações de campo separados para treino e teste
  var hist_treino = ui.Chart.feature.histogram(campo_treino, classe_solo).setOptions({
    title: 'Histograma das observações de campo para treino'
    });
  print(hist_treino);
  var hist_teste = ui.Chart.feature.histogram(campo_teste, classe_solo).setOptions({
    title: 'Histograma das observações de campo para teste'
    });
  print(hist_teste);

// Amostragem, Treinamento do Classificador e Classificação Supervisionada
  // Amostrar dados de treinamento
  var training = covar.sampleRegions({
    collection: campo_treino,
    properties: [classe_solo],
    geometries: true,
    tileScale: 4
  });
  print (training.size(), 'Observações de treinamento');

  // Treinar classificador Random Forest
  var trainedClassifier = ee.Classifier.smileRandomForest(100).train({
    features: training,
    classProperty: classe_solo,
    inputProperties: bands
  });

  // Classificação supervisionada
  var mds = covar.classify(trainedClassifier);
  // Aplicar filtro de moda ao mapa predito (pós-classificação)
  var mode = mds.focal_mode({
    radius: 1,
    kernelType: 'circle'
  });

// Avaliação por validação de campo
  // Cruzar resultados preditos com observações de campo separadas para teste 
  var teste = mds.sampleRegions({
    collection: campo_teste,
    properties: [classe_solo],
    geometries: true
  });
  print(teste.size(), 'Observações de teste');

  // Gerar matriz de confusão e exibir resultados dos indicadores de avaliação
  var confusionMatrix = teste.errorMatrix(classe_solo, 'classification');
  Export.table.toDrive(confusionMatrix);
  print('Acurácia global: ', confusionMatrix.accuracy());
  print('Kappa: ', confusionMatrix.kappa());
  print('Exatidão do Usuário: ', confusionMatrix.consumersAccuracy());
  print('Exatidão do Produtor: ', confusionMatrix.producersAccuracy());

// Exibir resultados na área do mapa

  // Centralizar e aproximar visualização sobre a área de estudo
  Map.centerObject(covar, 10);
  // Criar camada de relevo sombreado e adicionar à visualização no mapa
  var hillshade = ee.Terrain.hillshade(covar.select('b1'), 270, 45);
  Map.addLayer(hillshade, {min: 140, max:200}, 'Relevo');
  /*
  // Opcional: adicionar camada com covariáveis preditivas ao mapa - ex.: valores de elevação.
  Map.addLayer(covar, {bands: ['b1'], min: 498, max: 1014, palette:['ff0000','ff8d00','fbff00','9dff00','00ff89','00f3ff','06a3ff','2700ff','a902ff','ff00f7']}, 'MDEHC');
  */
  // Adicionar resultados de predição à área de visualização
  Map.addLayer(mds.randomVisualizer(), {opacity: 0.7}, 'MDS');
  /*
  // Opcional: adicionar camada com MDS após filtro de pós-classificação (Moda)
  Map.addLayer(mode.randomVisualizer(), {}, 'MDS (Moda)');
  */
  // Exibir pontos de campo separados para treinamento
  Map.addLayer(training.draw({color: '006600', strokeWidth: 5}), {}, 'Obs. Treino');
  // Exibir pontos de campo separados para teste
  Map.addLayer(teste.draw({color: 'red', strokeWidth: 5}), {}, 'Pts Teste');

// Exportar MDS predito
Export.image.toAsset({
  image: mds,
  region: area
});
/* Fim do documento.*/
